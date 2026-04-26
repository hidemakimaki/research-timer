const NG_WORDS = [
  '死ね', '殺す', 'バカ', 'ばか', 'クソ', 'くそ',
  'うざい', 'キモい', 'きもい', 'ウザい',
]

export function validateDisplayName(name) {
  const trimmed = name.trim()
  const chars = [...trimmed]
  if (chars.length === 0) return '表示名を入力してください'
  if (chars.length < 3) return '3文字以上で入力してください'
  if (chars.length > 20) return '20文字以内で入力してください'
  const emojiCount = (trimmed.match(/\p{Extended_Pictographic}/gu) || []).length
  if (emojiCount > 2) return '絵文字は2個までです'
  const lower = trimmed.toLowerCase()
  for (const word of NG_WORDS) {
    if (lower.includes(word.toLowerCase())) return '使用できない文字が含まれています'
  }
  return null
}
