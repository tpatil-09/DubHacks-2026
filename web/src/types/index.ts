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
  /** When the member agreed to the public-records background check shown on their profile. */
  screeningConsentAt?: number
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
  firstName: string
  /** Collected for background-check matching; not shown on cards, chat, or matches — only the first name is public. */
  lastName: string
  /** YYYY-MM-DD date of birth. Age is derived from this, not stored directly. */
  birthdate: string
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

/** Fun-game answers: question id (or `picks` for a puzzle) to the chosen option ids. */
export type GameAnswers = Record<string, string[]>

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

export type UserReportReason = 'harassment' | 'fake' | 'scam' | 'underage' | 'other'
