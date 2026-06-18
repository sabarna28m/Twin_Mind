export interface Session {
  id: number;
  title: string;
  subject: string | null;
  duration_minutes: number;
  status: string;
  created_at: string | null;
}
