import type {
  Account,
  GameAnswers,
  LikeType,
  Match,
  Message,
  NewMessage,
  Profile,
  PaperAirplane,
  PaperDesign,
  QuizResult,
  SessionUser,
  UserReportReason,
  WyrChoice,
} from '../types'

export type Unsubscribe = () => void

/** Everything the UI needs from the backend. Implemented by the Firebase and demo backends. */
export interface Backend {
  kind: 'firebase' | 'demo'

  onAuthChange(callback: (user: SessionUser | null) => void): Unsubscribe
  signInWithGoogle(): Promise<void>
  signInWithEmail(email: string, password: string, createAccount: boolean): Promise<void>
  signInDemo(): Promise<void>
  signOut(): Promise<void>

  /** Idempotently copy the signed-in member's old Firestore data into the active database. */
  migrateLegacyData(): Promise<void>

  getAccount(uid: string): Promise<Account | null>
  saveAccount(uid: string, patch: Partial<Account>): Promise<void>
  getProfile(uid: string): Promise<Profile | null>
  saveProfile(uid: string, patch: Partial<Profile>): Promise<void>
  uploadPhoto(uid: string, file: Blob): Promise<string>

  listDiscover(uid: string): Promise<Profile[]>
  /** Records a like/pass. Returns the match id when the like is mutual. */
  setLike(uid: string, targetUid: string, type: LikeType): Promise<{ matchId?: string }>

  subscribeMatches(uid: string, callback: (matches: Match[]) => void): Unsubscribe
  unmatch(uid: string, matchId: string): Promise<void>
  subscribeMessages(matchId: string, callback: (messages: Message[]) => void): Unsubscribe
  sendMessage(matchId: string, message: NewMessage): Promise<void>
  answerGameShare(matchId: string, messageId: string, uid: string, choice: WyrChoice): Promise<void>

  saveQuizResult(uid: string, result: QuizResult): Promise<void>
  getWyrAnswers(uid: string): Promise<Record<string, WyrChoice>>
  saveWyrAnswer(uid: string, promptId: string, choice: WyrChoice): Promise<void>
  getWyrAnswersFor(uids: string[]): Promise<Record<string, Record<string, WyrChoice>>>

  /**
   * Throws a note to a random discoverable member. The caller never learns who caught it.
   * `subscribeAirplanes` hides the catcher until they reply.
   */
  throwPaperAirplane(fromUid: string, design: PaperDesign, text: string): Promise<void>
  subscribeAirplanes(uid: string, callback: (planes: { inbox: PaperAirplane[]; sent: PaperAirplane[] }) => void): Unsubscribe
  replyToAirplane(uid: string, planeId: string, text: string): Promise<void>

  /** Fun quizzes and match puzzles, keyed by game id. */
  getGameAnswers(uid: string): Promise<Record<string, GameAnswers>>
  saveGameAnswers(uid: string, gameId: string, answers: GameAnswers): Promise<void>
  /** Other discoverable members (not blocked) who played this game, with their answers. */
  listGamePlayers(uid: string, gameId: string): Promise<{ profile: Profile; answers: GameAnswers }[]>

  /**
   * The member's background check, produced by the background_check pipeline when they join.
   * Returns the raw report.json object (the UI validates it), or null while it is still running.
   */
  getScreening(subjectUid: string): Promise<unknown>

  block(uid: string, otherUid: string): Promise<void>
  unblock(uid: string, otherUid: string): Promise<void>
  listBlocked(uid: string): Promise<string[]>
  reportUser(uid: string, otherUid: string, reason: UserReportReason, details: string): Promise<void>
  deleteMyData(uid: string): Promise<void>
}

export function matchIdFor(a: string, b: string): string {
  return [a, b].sort().map((uid) => `${uid.length}:${uid}`).join('')
}

export function otherUser(match: Match, uid: string): string {
  return match.users[0] === uid ? match.users[1] : match.users[0]
}
