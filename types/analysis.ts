export type ParsedActivityRow = {
  employeeName?: string;
  date?: string;
  appName?: string;
  website?: string;
  url?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  idleMinutes: number;
  category?: string;
};

export type ActivitySummary = {
  employeeName?: string;
  date?: string;
  totalProductiveMinutes: number;
  totalIdleMinutes: number;
  totalUnproductiveMinutes: number;
  mostUsedApps: { name: string; minutes: number }[];
  mostVisitedWebsites: { name: string; minutes: number }[];
  workRelatedUsage: string[];
  irrelevantUsage: { name: string; minutes: number; reason: string }[];
  suspiciousTimeGaps: string[];
  activityPatterns: string[];
  rows: ParsedActivityRow[];
};

export type LoginLogoutSummary = {
  employeeName?: string;
  date?: string;
  loginTime?: string;
  logoutTime?: string;
  totalTrackedMinutes: number;
  attendanceStatus: string;
  lateLogin: boolean;
  earlyLogout: boolean;
  missingLogout: boolean;
  disciplineSummary: string;
};

export type FinalAnalysisJson = {
  completed_tasks: string[];
  pending_tasks: string[];
  eod_quality: "Clear" | "Average" | "Vague" | "Weak/Suspicious";
  eod_summary: string;
  mismatch_analysis: string;
  irrelevant_usage_analysis: string;
  flags: string[];
  score_breakdown: {
    attendance: number;
    work_hours: number;
    productive_activity: number;
    eod_clarity: number;
    timechamp_eod_match: number;
  };
  final_score: number;
  risk_level: "GREEN" | "YELLOW" | "RED";
  manager_summary: string;
  recommended_action: string;
};
