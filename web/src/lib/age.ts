/** Age in whole years from a YYYY-MM-DD birthdate. Returns null if invalid. */
export function ageFrom(birthdate: string, today: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const born = new Date(year, month - 1, day)
  if (born.getMonth() !== month - 1 || born > today) return null
  let age = today.getFullYear() - year
  const hadBirthday = today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day)
  if (!hadBirthday) age -= 1
  return age
}
