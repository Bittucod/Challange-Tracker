export interface IconOption {
  value: string;
  label: string;
}

export const ALL_ICONS: IconOption[] = [
  { value: 'target', label: 'Target (General)' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'threads', label: 'Threads' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'discord', label: 'Discord' },
  { value: 'github', label: 'GitHub' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'substack', label: 'Substack' },
  { value: 'medium', label: 'Medium' },
  { value: 'slack', label: 'Slack' },
  { value: 'figma', label: 'Figma' },
  { value: 'notion', label: 'Notion' },
  { value: 'code', label: 'Code / Dev' },
  { value: 'workout', label: 'Workout / Gym' },
  { value: 'book', label: 'Reading / Book' },
  { value: 'pen', label: 'Writing / Journal' },
  { value: 'podcast', label: 'Podcast / Audio' },
  { value: 'water', label: 'Hydration / Water' },
  { value: 'run', label: 'Run / Steps' },
  { value: 'meditation', label: 'Meditation / Zen' }
];

function hasWord(text: string, ...words: string[]): boolean {
  const tokens = text.toLowerCase().split(/[\s,._\-\/]+/);
  return words.some((w) => tokens.includes(w.toLowerCase()));
}

export function detectIconFromName(name: string): string {
  if (!name) return 'target';
  const n = name.trim().toLowerCase();

  // Social & Content Platforms
  if (n.includes('thread')) return 'threads';
  if (n.includes('discord')) return 'discord';
  if (n.includes('github') || hasWord(n, 'git', 'commit')) return 'github';
  if (n.includes('tiktok') || n.includes('tik tok')) return 'tiktok';
  if (n.includes('telegram') || hasWord(n, 'tg')) return 'telegram';
  if (n.includes('whatsapp') || hasWord(n, 'wa')) return 'whatsapp';
  if (n.includes('facebook') || hasWord(n, 'fb')) return 'facebook';
  if (n.includes('twitch') || n.includes('stream')) return 'twitch';
  if (n.includes('substack') || n.includes('newsletter')) return 'substack';
  if (n.includes('medium')) return 'medium';
  if (n.includes('slack')) return 'slack';
  if (n.includes('figma') || n.includes('ui design')) return 'figma';
  if (n.includes('notion')) return 'notion';
  if (n.includes('youtube') || hasWord(n, 'yt', 'vlog') || n.includes('video')) return 'youtube';
  if (n.includes('linkedin')) return 'linkedin';
  if (n.includes('reddit')) return 'reddit';
  if (n.includes('instagram') || n.includes('insta') || hasWord(n, 'ig', 'reel', 'reels')) return 'instagram';
  if (hasWord(n, 'x') || n.includes('twitter') || n.includes('tweet')) return 'x';

  // Personal Habits & Disciplines
  if (n.includes('leetcode') || n.includes('coding') || n.includes('program') || hasWord(n, 'code', 'dev', 'build', 'dsa', 'algorithm')) return 'code';
  if (n.includes('workout') || n.includes('fitness') || n.includes('exercise') || hasWord(n, 'gym', 'lift', 'pushup', 'pushups', 'pullup', 'pullups', 'cardio')) return 'workout';
  if (n.includes('water') || n.includes('hydrat') || hasWord(n, 'drink', 'fluid')) return 'water';
  if (n.includes('marathon') || hasWord(n, 'run', 'running', 'walk', 'walking', 'step', 'steps', 'jog', 'jogging')) return 'run';
  if (n.includes('meditat') || n.includes('mindful') || hasWord(n, 'zen', 'yoga', 'breath', 'breathing')) return 'meditation';
  if (n.includes('podcast') || hasWord(n, 'listen', 'audio', 'mic')) return 'podcast';
  if (n.includes('reading') || hasWord(n, 'book', 'books', 'read', 'study', 'learn', 'chapter', 'chapters')) return 'book';
  if (n.includes('writing') || hasWord(n, 'write', 'blog', 'journal', 'diary', 'essay', 'pen', 'post', 'posts')) return 'pen';

  return 'target';
}
