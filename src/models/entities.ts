export type UserRole = 'admin' | 'ombudsman' | 'sector_manager';
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: UserRole;
  active: boolean;
  must_change_password: boolean;
  created_at: Date;
  updated_at: Date;
}
export type LoginProfile = Pick<
  Profile,
  'id' | 'email' | 'password_hash' | 'role' | 'must_change_password'
>;
export type SessionPrincipal = Pick<Profile, 'id' | 'role' | 'must_change_password'>;
export type PublicProfile = Pick<Profile, 'id' | 'email' | 'full_name' | 'role' | 'active'> & {
  mustChangePassword: boolean;
};
export type ManagedProfile = PublicProfile & Pick<Profile, 'created_at'>;
export interface Session {
  jti: string;
  profile_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}
export interface Sector {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}
export interface SectorAssignment {
  profile_id: string;
  sector_id: string;
}
export interface Question {
  id: string;
  text: string;
  kind: 'rating' | 'nps';
  sector_id: string | null;
  position: number;
  active: boolean;
  required: boolean;
}
export type QuestionView = Omit<Question, 'required'>;
export interface Survey {
  id: string;
  sector_id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  tablet_reset_seconds: number;
}
export type ManagedSurvey = Pick<Survey, 'id' | 'title' | 'status' | 'sector_id'> & {
  sector_name: string;
  sector_slug: string;
};
export interface PublicSurveyRow {
  survey_id: string;
  title: string;
  tablet_reset_seconds: number;
  sector_id: string;
  sector_name: string;
  questions: {
    id: string;
    text: string;
    kind: Question['kind'];
    required: boolean;
    sectorId: string | null;
  }[];
}
export interface SurveyResponse {
  id: string;
  survey_id: string;
  nps: number;
  shift: 'morning' | 'afternoon' | 'night' | null;
  attended_at: Date | null;
  created_at: Date;
}
export interface Answer {
  id: string;
  response_id: string;
  question_id: string;
  value: number;
  question_text: string;
}
export interface Complaint {
  id: string;
  response_id: string;
  comment: string | null;
  contact: string | null;
  contact_consent: boolean;
  status: 'open' | 'in_progress' | 'closed';
  created_at: Date;
  updated_at: Date;
  sector_id: string;
}
export interface NotificationJob {
  id: string;
  complaint_id: string;
  attempts: number;
  delivered_at: Date | null;
}
export interface SubmissionKey {
  survey_id: string;
  submission_id: string;
  response_id: string | null;
  session_hash: string;
}
export interface ReportResponse extends Omit<SurveyResponse, 'survey_id'> {
  sector_id: string;
  sector_name: string;
  answers: { questionId: string; questionText: string; score: number }[];
  complaint: {
    comment: string | null;
    contact: string | null;
    contactConsent: boolean;
    status: Complaint['status'];
  } | null;
}
