export type OnboardingStep = 'basics' | 'photos' | 'about' | 'quiz' | 'complete'

export interface SessionUser {
  uid: string
  email: string | null
  displayName: string | null
}

export interface Account {
  uid: string
  email: string | null
  onboardingStep: OnboardingStep
  settings: { discoverable: boolean; sounds: boolean }
  createdAt: number
}

export type QuizAxis = 'cozyAdventurous' | 'plannerSpontaneous' | 'chattyChill' | 'nightEarly'
export type QuizAxes = Record<QuizAxis, number>

export interface PublicQuiz {
  personaId: string
  axes: QuizAxes
}

export interface QuizResult extends PublicQuiz {
  answers: Record<string, string>
  completedAt: number
}

export interface ProfilePrompt {
  question: string
  answer: string
}

export interface Profile {
  uid: string
  displayName: string
  /** Self-reported age in years; no birthdate is collected. */
  age: number
  gender: string
  interestedIn: string[]
  city: string
  bio: string
  prompts: ProfilePrompt[]
  /** Download URLs, or `avatar:<emoji>:<colorToken>` for generated demo avatars. */
  photos: string[]
  interests: string[]
  quiz?: PublicQuiz
  discoverable: boolean
  isDemo?: boolean
  updatedAt: number
}

export type LikeType = 'like' | 'pass'

export interface Match {
  id: string
  users: [string, string]
  createdAt: number
  lastMessageAt?: number
  lastMessagePreview?: string
}

export type WyrChoice = 'a' | 'b'

export interface Message {
  id: string
  matchId: string
  senderId: string
  type: 'text' | 'game_share' | 'system'
  text: string
  createdAt: number
  game?: { promptId: string; answers: Record<string, WyrChoice> }
}

export type NewMessage = Pick<Message, 'senderId' | 'type' | 'text' | 'game'>

export type ReportStatus =
  | 'queued'
  | 'searching'
  | 'verifying'
  | 'analyzing'
  | 'complete'
  | 'incomplete'
  | 'failed'

export interface ReportRequest {
  id: string
  requesterUid: string
  subjectUid?: string
  subjectName: string
  context?: string
  status: ReportStatus
  createdAt: number
  error?: string
}

export interface SafetyReportInput {
  subjectUid?: string
  subjectName: string
  context?: string
  confirmedScope: true
}

export type UserReportReason = 'harassment' | 'fake' | 'scam' | 'underage' | 'other'
