import "server-only";

import {
  ACTIVE_WINDOW_DAYS,
  ADMIN_PAGE_SIZE,
  INACTIVE_AFTER_DAYS,
  NEW_USER_DAYS,
  type AdminRange,
  type Feature,
  type FeedbackStatus,
  type UserFilter,
  type UserSort,
} from "@/features/admin/analytics/definitions";
import { createClient } from "@/lib/supabase/server";

/*
 * Accès aux RPC admin (agrégats et champs de compte/produit seulement). Chaque fonction SQL
 * revérifie le rôle (admin_required). Erreurs : code technique journalisé, message générique.
 */

export class AdminDataError extends Error {}

function fail(context: string, code: string | undefined): never {
  console.error(`[admin] ${context}`, { code });
  throw new AdminDataError("Les données d'administration sont indisponibles pour le moment.");
}

const iso = (date: Date) => date.toISOString();

export type AdminOverview = {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  onboardedTotal: number;
  firstCheckinTotal: number;
  checkins: number;
  newUsers7d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  checkins7d: number;
  users3Checkins: number;
  users7Checkins: number;
  feedbackPeriod: number;
  feedbackTotal: number;
  aiReflectionsPeriod: number;
  aiReflectionsTotal: number;
  pdfReportsPeriod: number;
  pdfReportsTotal: number;
};

export async function getAdminOverview(range: AdminRange): Promise<AdminOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview", { p_from: iso(range.from), p_to: iso(range.to) });
  if (error || !data?.[0]) fail("Indicateurs", error?.code);
  const r = data[0];
  return {
    totalUsers: r.total_users,
    newUsers: r.new_users,
    activeUsers: r.active_users,
    onboardedTotal: r.onboarded_total,
    firstCheckinTotal: r.first_checkin_total,
    checkins: r.checkins,
    newUsers7d: r.new_users_7d,
    activeUsers7d: r.active_users_7d,
    activeUsers30d: r.active_users_30d,
    checkins7d: r.checkins_7d,
    users3Checkins: r.users_3_checkins,
    users7Checkins: r.users_7_checkins,
    feedbackPeriod: r.feedback_period,
    feedbackTotal: r.feedback_total,
    aiReflectionsPeriod: r.ai_reflections_period,
    aiReflectionsTotal: r.ai_reflections_total,
    pdfReportsPeriod: r.pdf_reports_period,
    pdfReportsTotal: r.pdf_reports_total,
  };
}

export type TimeseriesPoint = { bucket: string; signups: number; activeUsers: number; checkins: number };

export async function getAdminTimeseries(range: AdminRange, bucket: "day" | "week"): Promise<TimeseriesPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_timeseries", { p_from: iso(range.from), p_to: iso(range.to), p_bucket: bucket });
  if (error) fail("Séries", error.code);
  return data.map((row) => ({ bucket: row.bucket, signups: row.signups, activeUsers: row.active_users, checkins: row.checkins }));
}

export type AdminFunnel = { signups: number; onboarded: number; firstCheckin: number; returned: number; j7Eligible: number; activeJ7: number };

export async function getAdminFunnel(range: AdminRange): Promise<AdminFunnel> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_funnel", { p_from: iso(range.from), p_to: iso(range.to) });
  if (error || !data?.[0]) fail("Entonnoir", error?.code);
  const r = data[0];
  return { signups: r.signups, onboarded: r.onboarded, firstCheckin: r.first_checkin, returned: r.returned, j7Eligible: r.j7_eligible, activeJ7: r.active_j7 };
}

export type RetentionCohort = {
  cohortWeek: string;
  signups: number;
  days: Record<1 | 3 | 7 | 14 | 30, { eligible: number; retained: number }>;
};

export async function getAdminRetention(): Promise<RetentionCohort[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_retention");
  if (error) fail("Rétention", error.code);
  return data.map((r) => ({
    cohortWeek: r.cohort_week,
    signups: r.signups,
    days: {
      1: { eligible: r.e1, retained: r.r1 },
      3: { eligible: r.e3, retained: r.r3 },
      7: { eligible: r.e7, retained: r.r7 },
      14: { eligible: r.e14, retained: r.r14 },
      30: { eligible: r.e30, retained: r.r30 },
    },
  }));
}

export async function getAdminFeatureAdoption(range: AdminRange): Promise<Record<Feature, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_feature_adoption", { p_from: iso(range.from), p_to: iso(range.to) });
  if (error) fail("Adoption", error.code);
  const result: Record<Feature, number> = { checkin: 0, craving: 0, plan: 0, achievements: 0, ai: 0, pdf: 0, feedback: 0 };
  for (const row of data) if (row.feature in result) result[row.feature as Feature] = row.users;
  return result;
}

export type AdminUserRow = {
  code: string;
  signedUpAt: string;
  onboarded: boolean;
  firstCheckinAt: string | null;
  lastActivityAt: string | null;
  checkins: number;
};

export async function getAdminUsersPage(filter: UserFilter, sort: UserSort, page: number): Promise<{ rows: AdminUserRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_users_page", {
    p_filter: filter,
    p_sort: sort,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: (page - 1) * ADMIN_PAGE_SIZE,
    p_new_days: NEW_USER_DAYS,
    p_active_days: ACTIVE_WINDOW_DAYS,
    p_inactive_days: INACTIVE_AFTER_DAYS,
  });
  if (error) fail("Comptes", error.code);
  return {
    total: data[0]?.total_count ?? 0,
    rows: data.map((r) => ({
      code: r.code,
      signedUpAt: r.signed_up_at,
      onboarded: r.onboarded,
      firstCheckinAt: r.first_checkin_at,
      lastActivityAt: r.last_activity_at,
      checkins: r.checkins,
    })),
  };
}

export type AdminUserDetail = AdminUserRow & { features: Feature[]; feedbackCount: number };

export async function getAdminUserDetail(code: string): Promise<AdminUserDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_user_detail", { p_code: code });
  if (error) fail("Fiche", error.code);
  const r = data[0];
  if (!r) return null;
  const features: Feature[] = [];
  if (r.used_checkin) features.push("checkin");
  if (r.used_craving) features.push("craving");
  if (r.used_plan) features.push("plan");
  if (r.used_achievements) features.push("achievements");
  if (r.used_ai) features.push("ai");
  if (r.used_pdf) features.push("pdf");
  if (r.feedback_count > 0) features.push("feedback");
  return {
    code: r.code,
    signedUpAt: r.signed_up_at,
    onboarded: r.onboarded,
    firstCheckinAt: r.first_checkin_at,
    lastActivityAt: r.last_activity_at,
    checkins: r.checkins,
    features,
    feedbackCount: r.feedback_count,
  };
}

/** Courriel d'un compte pour le support : action volontaire, journalisée par la base. */
export async function revealAccountEmail(code: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reveal_account_email", { p_code: code });
  if (error) fail("Informations de compte", error.code);
  return data;
}

export type AdminFeedbackRow = {
  id: string;
  createdAt: string;
  code: string;
  excluded: boolean;
  category: string;
  message: string;
  pageContext: string | null;
  status: FeedbackStatus;
};

export async function getAdminFeedbackPage(
  category: string | null,
  status: FeedbackStatus | null,
  page: number,
  pageSize: number = ADMIN_PAGE_SIZE,
): Promise<{ rows: AdminFeedbackRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_feedback_page", {
    // null = tous (la fonction SQL l'accepte ; le type généré ne l'indique pas).
    p_category: category as string,
    p_status: status as string,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) fail("Avis", error.code);
  return {
    total: data[0]?.total_count ?? 0,
    rows: data.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      code: r.code,
      excluded: r.excluded,
      category: r.category,
      message: r.message,
      pageContext: r.page_context,
      status: r.status as FeedbackStatus,
    })),
  };
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_feedback_status", { p_id: id, p_status: status });
  if (error) {
    console.error("[admin] Statut d'avis", { code: error.code });
    return false;
  }
  return data === true;
}
