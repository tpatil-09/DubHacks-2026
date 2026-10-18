export interface WyrPrompt {
  id: string
  a: string
  b: string
  tag: 'silly' | 'deep' | 'food' | 'travel' | 'dating'
}

const raw: [string, string, WyrPrompt['tag']][] = [
  ['Have a pet dragon the size of a cat', 'Have a pet cat the size of a dragon', 'silly'],
  ['Only eat breakfast foods forever', 'Never eat breakfast foods again', 'food'],
  ['Always know when someone is lying', 'Always get away with lying', 'deep'],
  ['Live in a treehouse', 'Live in a houseboat', 'silly'],
  ['Go on a first date at an arcade', 'Go on a first date at a bookstore', 'dating'],
  ['Travel to the past', 'Travel to the future', 'deep'],
  ['Have a personal theme song', 'Have a personal laugh track', 'silly'],
  ['Explore space', 'Explore the deep ocean', 'travel'],
  ['Give up dessert', 'Give up cheese', 'food'],
  ['Be able to talk to animals', 'Speak every human language', 'deep'],
  ['Spend a week in a cozy cabin', 'Spend a week in a big city', 'travel'],
  ['Get a handwritten letter', 'Get a surprise playlist', 'dating'],
  ['Have spaghetti for hair', 'Sweat maple syrup', 'silly'],
  ['Always be 10 minutes early', 'Always be 5 minutes late', 'silly'],
  ['Know the ending of every movie', 'Never be able to finish a movie', 'silly'],
  ['Win a cooking competition', 'Win a dance battle', 'silly'],
  ['Have a picnic in the park', 'Have a rooftop dinner', 'dating'],
  ['Relive your best day once', 'Skip your worst day', 'deep'],
  ['Eat only spicy food', 'Eat only bland food', 'food'],
  ['Backpack across Europe', 'Road trip across the country', 'travel'],
  ['Have unlimited plane tickets', 'Have unlimited concert tickets', 'travel'],
  ['Be famous for a song', 'Be famous for a recipe', 'silly'],
  ['Slow dance in the kitchen', 'Karaoke duet in public', 'dating'],
  ['Have a robot chef', 'Have a robot housekeeper', 'silly'],
  ['Read minds for a day', 'Be invisible for a day', 'deep'],
  ['Get pizza with pineapple', 'Get pizza with anchovies', 'food'],
  ['Watch every sunrise', 'Watch every sunset', 'deep'],
  ['Visit every national park', 'Visit every world capital', 'travel'],
  ['Have a partner who cooks', 'Have a partner who plans trips', 'dating'],
  ['Be a wizard', 'Be a superhero', 'silly'],
  ['Have a garden full of flowers', 'Have a garden full of vegetables', 'deep'],
  ['Only drink coffee', 'Only drink tea', 'food'],
  ['Go stargazing', 'Go to a night market', 'dating'],
  ['Have a pause button for life', 'Have a rewind button for life', 'deep'],
  ['Live by the beach', 'Live in the mountains', 'travel'],
  ['Hiccup forever', 'Always feel like you need to sneeze', 'silly'],
  ['Learn every instrument', 'Learn every sport', 'deep'],
  ['Eat a giant cupcake', 'Eat a hundred tiny cupcakes', 'food'],
  ['Get matching tattoos', 'Get matching sweaters', 'dating'],
  ['Be stuck in a romcom', 'Be stuck in a video game', 'silly'],
  ['Have endless free time', 'Have endless money', 'deep'],
  ['Travel by hot air balloon', 'Travel by sleeper train', 'travel'],
  ['Eat tacos every day', 'Eat sushi every day', 'food'],
  ['Have a cozy movie night in', 'Have a fancy night out', 'dating'],
  ['Talk like a pirate forever', 'Sing everything you say', 'silly'],
  ['Know your future', 'Change your past', 'deep'],
  ['Take a cooking class together', 'Take a pottery class together', 'dating'],
  ['Visit Tokyo', 'Visit Paris', 'travel'],
  ['Give up fries', 'Give up chips', 'food'],
  ['Be a famous painter', 'Be a famous author', 'deep'],
  ['Fight one horse-sized duck', 'Fight 100 duck-sized horses', 'silly'],
  ['Get love letters', 'Get surprise snacks', 'dating'],
  ['Camp in a tent', 'Glamp in a yurt', 'travel'],
  ['Have soup for every meal', 'Have salad for every meal', 'food'],
  ['Be the funniest person in the room', 'Be the smartest person in the room', 'deep'],
  ['Ride a giant tortoise', 'Ride a giant penguin', 'silly'],
  ['Plan every date', 'Be surprised on every date', 'dating'],
  ['Spend a month in Iceland', 'Spend a month in Bali', 'travel'],
  ['Only eat with chopsticks', 'Only eat with a spoon', 'food'],
  ['Have a tiny pet elephant', 'Have a giant pet hamster', 'silly'],
  ['Have one best friend', 'Have ten good friends', 'deep'],
  ['Meet at a coffee shop', 'Meet at a farmers market', 'dating'],
]

export const wyrPrompts: WyrPrompt[] = raw.map(([a, b, tag], index) => ({
  id: `wyr-${String(index + 1).padStart(3, '0')}`,
  a,
  b,
  tag,
}))

export function wyrPromptById(id: string): WyrPrompt | undefined {
  return wyrPrompts.find((prompt) => prompt.id === id)
}

/** Picks a random prompt, preferring ones the player hasn't answered yet. */
export function nextWyrPrompt(answered: Set<string>, random: () => number = Math.random): WyrPrompt {
  const fresh = wyrPrompts.filter((prompt) => !answered.has(prompt.id))
  const pool = fresh.length > 0 ? fresh : wyrPrompts
  return pool[Math.floor(random() * pool.length)]
}
