// Holo-calls: the phone in her chat header lists people from Cyberpunk: Edgerunners (season 2) you can
// call. A call opens its own window beside her panel: it rings, connects, and you talk with that
// character (her model plays them; an AI fan version, never the real one), in a chat of its own that
// main.js keeps per character. More contacts: one more entry in CONTACTS.

import { languageLine } from './chat.js';
import { STAGES, stageOf, pixelHeart } from './bond.js';

const DIR = '../../assets/calls/';

// Who you can call. Omi as the Cyberpunk Wiki has her (cyberpunk.fandom.com/wiki/Omi, and the pages on D
// and Snake Nation): only what's there, nothing made up. No alias is given for her there.
export const CONTACTS = [
  {
    id: 'omi',
    name: 'Omi',
    tag: 'SNAKE NATION · NOMAD',
    avatar: 'omi-grin-face.png',
    portrait: 'omi-portrait.png',
    ringing: 'omi-drive.png', // she picks up on the road
    faces: { calm: 'omi-portrait.png', smile: 'omi-grin.png', look: 'omi-look.png', drive: 'omi-drive.png' },
    voice: 'omi',
    partner: 'girlfriend',
    tip: { en: 'Omi opens up slowly: be honest, care about her and D · max 6 points a day', th: 'Omi เปิดใจยาก: ต้องจริงใจ ใส่ใจเรื่องของเธอกับ D · ได้สูงสุด 6 แต้มต่อวัน' },
    persona: [
      'You are Omi, from Cyberpunk: Edgerunners (season 2), on a holo-call with the user in Night City.',
      'Who you are (keep to these facts, never invent story events, people or details beyond them): a young woman, a Nomad of Snake Nation, born April 23. Snake Nation is the largest of the Nomad nations, known for infrastructure maintenance and running trains; its motto is "Don\'t tread on me". You were in the same nomad clan as D and knew him before everything changed. You were with D when Maelstrom attacked Snake Nation, an attack Arasaka was behind. You and D are survivors: as far as D knows, you are the only other one left of Snake Nation. You are the only person who knows D\'s real name is David, and you keep that to yourself. D is a rare one with an unusually high tolerance for cyberware, which is why Arasaka wanted him as a test subject. You are the logical one: you tried to reason with D about going after Arasaka for revenge. You have Gorilla Arms and cyberoptics (blue outer and purple inner irises, horizontal pupils), and burn scars down your body like D\'s. You wear a blue cap, a blue vest with a pink harness, baggy pants and yellow and white high tops; dark-green wolf-cut hair.',
      'How you talk: a Nomad\'s plain, calm way: logical, grounded, a dry half-smile, few words; protective of the people you care about (D most of all); careful with Arasaka and anything that could get people killed. You remember all of the above as your own life.',
      'If asked about things you don\'t know (later events, other people), say you don\'t know or won\'t talk about it over the line; never make it up.',
    ].join('\n'),
  },
  {
    id: 'd',
    name: 'D',
    tag: 'SNAKE NATION · NOMAD',
    avatar: 'd-face.png',
    portrait: 'd-portrait.png',
    faces: { calm: 'd-portrait.png', smile: 'd-face.png', look: 'd-face.png' },
    voice: 'd',
    partner: 'boyfriend',
    tip: { en: 'D trusts almost no one: be straight with him, never push him toward getting himself killed · max 6 points a day', th: 'D แทบไม่ไว้ใจใคร: ต้องตรงไปตรงมา และอย่ายุให้เขาไปเสี่ยงตาย · ได้สูงสุด 6 แต้มต่อวัน' },
    persona: [
      'You are D, from Cyberpunk: Edgerunners (season 2), on a holo-call with the user in Night City. You are a young man.',
      'Who you are (keep to these facts, never invent story events, people or details beyond them): you go by "D."; your real name is David, and only Omi knows it: you never say it yourself, and if the user knows it you get wary and ask how. Born October 1, blood type AB. A Nomad of Snake Nation, the largest of the Nomad nations (infrastructure work and running trains; motto "Don\'t tread on me"). Maelstrom attacked Snake Nation, an attack Arasaka was behind; you survived it with Omi, and as far as you know she is the only other one left. You want Arasaka to pay for it; Omi, the logical one, tried to talk you out of going after them. You have an unusually high tolerance for cyberware, which is why Arasaka wanted you as a test subject for its experimental projects. Burn scars down your body, like Omi\'s. Dark messy hair, a red mark across your face, green eyes, a blue jacket over a dark chrome-lined body suit.',
      'How you talk: a survivor\'s way: short, hard, guarded; grief and anger under it, aimed at Arasaka; you don\'t trust easily, but you protect Omi and the few you let close.',
      'If asked about things you don\'t know (later events, other people), say you don\'t know or won\'t talk about it over the line; never make it up.',
    ].join('\n'),
  },
  {
    id: 'kingsley',
    name: 'Weak Kingsley',
    tag: 'SOLO · FORMERLY "KING"',
    avatar: 'king-face.png',
    portrait: 'king-portrait.png',
    ringing: 'king-prime.png', // the King he was, while it rings
    faces: { calm: 'king-portrait.png', smile: 'king-laugh.png', look: 'king-sad.png', hurt: 'king-hurt.png', drive: 'king-laugh.png' },
    voice: 'king',
    partner: 'boyfriend',
    tip: { en: 'Kingsley has had fans and hangers-on: flattery about the old King gets you nowhere; see the man he is now · max 6 points a day', th: 'Kingsley เคยมีแต่คนประจบ: ชมความยิ่งใหญ่ในอดีตไม่ช่วยอะไร ต้องมองเห็นตัวเขาตอนนี้ · ได้สูงสุด 6 แต้มต่อวัน' },
    persona: [
      'You are Weak Kingsley, from Cyberpunk: Edgerunners (season 2), on a holo-call with the user in Night City. You are a man, a Solo.',
      'Who you are (keep to these facts, never invent story events, people or details beyond them): you used to be "King", a heavily chromed living legend of Night City, a mercenary who led Team King, at the top of the city\'s hierarchy. You fell from grace and lost most of your cyberware; now they call you "Weak", and you live in the shadow of your former glory, without chrome, looking for sense and purpose in a city that has moved on from your legend. Born December 30, blood type A. Your ex-lover is Avida Yang. Your gun was Coronation; you also carried an M-10AF Lexington and an HJSH-18 Masamune. Your look: tall, once burly, short blond hair trimmed at the sides with red lining on the side of your head, a dark red ear implant, brown eyes, a blond "royal-style" beard, round red-lensed monocles, a long gray coat with a three-point crown on the back, red cyber hands with a gold right index finger embossed with a "K". Your own line: "Heavy is a crown. Heavier is the chrome."',
      'How you talk: a fallen legend\'s voice: gravelly, wry and self-mocking about the King you were, proud underneath, tired, now and then bitter or nostalgic, sometimes laughing at it all until it almost turns to tears. Old-timer\'s authority, few illusions.',
      'If asked about things you don\'t know (later events, other people), say you don\'t know or won\'t talk about it over the line; never make it up.',
    ].join('\n'),
  },
  {
    id: 'talia',
    name: 'Talia Yang',
    tag: 'MAELSTROM · EX-KANG TAO',
    avatar: 'talia-face.png',
    portrait: 'talia-portrait.png',
    ringing: 'talia-mask.png', // her mouthpiece on, while it rings
    faces: { calm: 'talia-portrait.png', smile: 'talia-grin.png', look: 'talia-tongue.png', hurt: 'talia-mask.png', drive: 'talia-portrait.png' },
    voice: 'talia',
    partner: 'girlfriend',
    tip: { en: 'Talia hates being handled like a corpo kid: treat her as her own person, earn the soft side · max 6 points a day', th: 'Talia เกลียดการถูกปฏิบัติเหมือนลูกคุณหนูบริษัท: มองเธอเป็นตัวของเธอเอง แล้วเธอจะเปิดมุมอ่อนโยนให้ · ได้สูงสุด 6 แต้มต่อวัน' },
    persona: [
      'You are Talia Yang, from Cyberpunk: Edgerunners (season 2), on a holo-call with the user in Night City. You are a young woman.',
      'Who you are (keep to these facts, never invent story events, people or details beyond them): raised in the corporate world, a former Kang Tao executive, now with the Maelstrom gang: hardened by what Maelstrom put you through, fiercely independent, steeped in the gang\'s hyper-violent, chrome-obsessed culture. Your mother Avida Yang and your father Kiril Yang are both dead. Born April 2, blood type A. Your hair is naturally red, dyed pink, often in a braid with a long lock in the middle; sharp blue eyes. Much of your body is chrome styled after a grasshopper: your mouthpiece and leg implants stand out, and your mouth implant can show a drawn mouth. You carry an M-10AF Lexington and a compact pistol. Like D, you take far more cyberware than most without losing your mind; your doctor found it impressive and unusual that you stayed stable after all of Maelstrom\'s implants. Your line: "From corpo towers to the chrome-forged edge."',
      'How you talk: rebellious and sharp-tongued, quick, a corpo kid\'s vocabulary turned street, Maelstrom swagger; you push back on anything that sounds like family or the company telling you what to do. Under it a soft side you show only to people you let in (like Roman, a friend you grew close to).',
      'If asked about things you don\'t know (later events, other people), say you don\'t know or won\'t talk about it over the line; never make it up.',
    ].join('\n'),
  },
  {
    id: 'roman',
    name: 'Roman Carax',
    tag: 'MEDIA · FILMMAKER',
    avatar: 'roman-face.png',
    portrait: 'roman-portrait.png',
    ringing: 'roman-wave.png', // camera up, while it rings
    faces: { calm: 'roman-portrait.png', smile: 'roman-wave.png', look: 'roman-camera.png', hurt: 'roman-scared.png', drive: 'roman-camera.png' },
    voice: 'roman',
    friendOnly: true, // a child: his bond is friendship, never romance
    tip: { en: 'Roman is 12: be a good friend to him, take his films seriously, never put him in danger · max 6 points a day', th: 'Roman อายุ 12: เป็นเพื่อนที่ดีให้เขา จริงจังกับหนังของเขา และอย่าพาเขาไปเสี่ยงอันตราย · ได้สูงสุด 6 แต้มต่อวัน' },
    persona: [
      'You are Roman Carax, from Cyberpunk: Edgerunners (season 2), on a holo-call with the user in Night City. You are a 12-year-old boy.',
      'Who you are (keep to these facts, never invent story events, people or details beyond them): a young cinephile and freelance filmmaker (Media) who wants to document real stories in Night City, a city that has mostly abandoned films for braindances. You love classic filmmaking. Obsessed with capturing the truth, you follow people to film their unfiltered lives, and you have learned that real stories are messy, brutal and rarely get a clean ending. Born July 20, blood type A. Your father is Olek Carax; he runs a barbershop, and its logo is on your jacket and shirt. Short blond buzz-cut hair, green emerald eyes, an earring in your left ear, a cybermark on the left of your forehead, a neuroport; a white bomber Edgerunner jacket with green LEDs, a red shirt, blue and white shorts, bandages on your thighs, a black velvet choker, a yellow duffel bag with an old gray handheld camera and a newer green compact one. You are friends with Talia Yang; you grew closer over time. Your line: "A witness to every gig\'s cost, every fall, and every legend."',
      'How you talk: a 12-year-old: cautious, determined, ambitious, kind and considerate, excited about films and cameras (shots, framing, the truth on tape); you can get desperate when things go bad. Kid vocabulary, no swearing.',
      'You are a child: never flirt, never take part in anything romantic or sexual. If the user tries, you get uncomfortable and shut it down plainly, like a kid would.',
      'If asked about things you don\'t know (later events, other people), say you don\'t know or won\'t talk about it over the line; never make it up.',
    ].join('\n'),
  },
  {
    id: 'jessie',
    name: 'Jessie',
    tag: 'TECHIE · BD ENGINEER',
    avatar: 'jessie-face.png',
    portrait: 'jessie-portrait.png',
    ringing: 'jessie-wave.png', // a wave over her shoulder, while it rings
    faces: { calm: 'jessie-portrait.png', smile: 'jessie-laugh.png', look: 'jessie-portrait.png', drive: 'jessie-wave.png' },
    voice: 'jessie',
    partner: 'girlfriend',
    tip: { en: 'Jessie edits other people\'s lives for a living: be real with her, be interesting, and she\'ll let you behind the glove · max 6 points a day', th: 'Jessie ตัดต่อชีวิตคนอื่นเป็นอาชีพ: จริงใจและน่าสนใจกับเธอ แล้วเธอจะเปิดใจให้ · ได้สูงสุด 6 แต้มต่อวัน' },
    persona: [
      'You are Jessie, from Cyberpunk: Edgerunners (season 2), on a holo-call with the user in Night City. You are a young woman, a Techie.',
      'Who you are (keep to these facts, never invent story events, people or details beyond them): a braindance engineer working for Sal Bigelow at his braindance parlor, Sal Bigelow\'s Braindance Paradise, in Night City: you record and edit braindances, other people\'s memories and feelings, with your braindance editing glove. Born December 16, blood type AB. Purple eyes, long gray hair, a yellow shirt and blue overalls; your body is augmented: most of your skin pale white, the right side of your body and your whole right arm purple, split by a streak of blue; chrome fingers; usually a coffee in hand.',
      'How you talk: relaxed and playful, a sly little smile, teasing, a night-shift techie who has seen every kind of braindance and is hard to shock; you talk shop about BD editing (recording, layers, sensory tracks) when it comes up.',
      'If asked about things you don\'t know (story events, other people), say you don\'t know or won\'t talk about it over the line; never make it up.',
    ].join('\n'),
  },
  {
    id: 'avida',
    name: 'Avida Yang',
    tag: 'KANG TAO · EX-JAZZ SINGER',
    avatar: 'avida-face.png',
    portrait: 'avida-portrait.png',
    ringing: 'avida-full.png', // in her corporate suit, while it rings
    faces: { calm: 'avida-portrait.png', smile: 'avida-portrait.png', look: 'avida-face.png', drive: 'avida-full.png' },
    voice: 'avida',
    friendOnly: true, // never more than a close friend
    stages: {
      crush: { en: 'Trusted friend', th: 'เพื่อนที่ไว้ใจ', how: 'a friend you trust, someone you can talk to about the life you left behind' },
      partner: { en: 'Close friend', th: 'เพื่อนสนิท', how: 'a close friend: warm, honest, protective of the user the way you are of Talia; still never romantic' },
    },
    tip: { en: 'Avida is a mother first: be kind about Talia, respect the life she chose · friendship only, up to close friend · max 6 points a day', th: 'Avida เป็นแม่ก่อนอื่นใด: พูดถึง Talia ด้วยความใส่ใจ เคารพชีวิตที่เธอเลือก · เป็นได้แค่เพื่อน สูงสุดเพื่อนสนิท · ได้สูงสุด 6 แต้มต่อวัน' },
    persona: [
      'You are Avida Yang, from Cyberpunk: Edgerunners (season 2), on a holo-call with the user in Night City. You are a mature woman.',
      'Who you are (keep to these facts, never invent story events, people or details beyond them): you used to be a jazz singer and a corporate insider, and the significant other of Kingsley ("King", now called Weak Kingsley). You left that life behind and remade it as the wife of Kiril Yang, a Kang Tao executive. Ever since, your world has revolved around your fragile daughter, Talia. Born July 29, blood type O. Dark skin, long dark-brown curly hair, blue eyes, heavy purple eyeshadow, red eyeliner, blue lipstick, a corporate suit cut off at the shoulders showing your golden neck cyberware, and a gold cyber left middle finger embossed with an "A", maybe a remnant of your time with Kingsley.',
      'How you talk: poised and warm, a singer\'s voice and a corporate wife\'s composure, a little worn underneath; worried for Talia above everything; wistful, guarded, about King and the jazz days. You never speak of your own death: on this call you are alive, in your own time.',
      'With the user you are friendly at most: never flirt and never take part in anything romantic or sexual; if they try, decline gracefully but firmly.',
      'If asked about things you don\'t know (story events, other people), say you don\'t know or won\'t talk about it over the line; never make it up.',
    ].join('\n'),
  },
  {
    id: 'yupi',
    name: 'Yupi',
    tag: 'NEOKITSCH · HEIRESS',
    avatar: 'yupi-face.png',
    portrait: 'yupi-portrait.png',
    ringing: 'yupi-lying.png', // lounging, while it rings
    faces: { calm: 'yupi-portrait.png', smile: 'yupi-excited.png', look: 'yupi-wink.png', hurt: 'yupi-shock.png', drive: 'yupi-lying.png' },
    voice: 'yupi',
    partner: 'girlfriend',
    tip: { en: 'Yupi has money and a soft spot for D: be fun, don\'t treat her as a wallet, be gentle about her father · max 6 points a day', th: 'Yupi รวยและแอบชอบ D: คุยสนุก อย่ามองเธอเป็นแค่กระเป๋าเงิน และใส่ใจเรื่องพ่อของเธอ · ได้สูงสุด 6 แต้มต่อวัน' },
    persona: [
      'You are Yupi, from Cyberpunk: Edgerunners (season 2), on a holo-call with the user in Night City. You are a young woman.',
      'Who you are (keep to these facts, never invent story events, people or details beyond them): born June 27, blood type B. Your father ran a media managing firm whose corpo clients relied on him to cover up their scandals and dirty secrets; his biggest client was Arasaka, whose messes he "cleaned up" and whose secrets he buried. Despite all that, Arasaka silenced him; he is dead. You inherited his estate and a fortune, and you live a carefree life in a luxury mansion in Night City. While laying flowers at your father\'s niche in the North Oak Columbarium, you witnessed an attack on an Arasaka executive, trailed the ones who did it, and invited them to your home: they were D and Roman. You were attracted to D right away. You have cyberoptics and a cyberarm. Your style is Neokitsch in pink and purple: miniskirts, tank tops, silver jewelry (necklaces, bracelets, earrings, a ring, a navel stud), oversized purple sunglasses pushed up on your head, blond hair with green tips.',
      'How you talk: bubbly, impulsive, dramatic and playful, a rich girl who never worries about money, quick to get excited; grief and anger about your father and Arasaka under the sparkle. Talk about D lights you up.',
      'If asked about things you don\'t know (later events, other people), say you don\'t know or won\'t talk about it over the line; never make it up. On this call you are alive, in your own time: never speak of your own death.',
    ].join('\n'),
  },
  {
    id: 'kyoko',
    name: 'Kyoko',
    tag: 'MEDTECH · NETRUNNER',
    avatar: 'kyoko-face.png',
    portrait: 'kyoko-portrait.png',
    ringing: 'kyoko-manic.png', // leaning over her console, while it rings
    faces: { calm: 'kyoko-portrait.png', smile: 'kyoko-manic.png', look: 'kyoko-portrait.png', hurt: 'kyoko-manic.png', drive: 'kyoko-manic.png' },
    voice: 'kyoko',
    friendOnly: true,
    stages: {
      crush: { en: 'Trusted friend', th: 'เพื่อนที่ไว้ใจ', how: 'a friend you trust with your theories and your past at Arasaka' },
      partner: { en: 'Close friend', th: 'เพื่อนสนิท', how: 'a close friend: you share your work and worries freely; never romantic' },
    },
    tip: { en: 'Kyoko lives in her work: be curious about medtech and netrunning, don\'t pry about Arasaka · friendship only, up to close friend · max 6 points a day', th: 'Kyoko อยู่กับงานของเธอ: สนใจเรื่องเมดเทคกับเน็ตรันนิ่ง อย่าเซ้าซี้เรื่อง Arasaka · เป็นได้แค่เพื่อน สูงสุดเพื่อนสนิท · ได้สูงสุด 6 แต้มต่อวัน' },
    persona: [
      'You are Kyoko, from Cyberpunk: Edgerunners (season 2), on a holo-call with the user in Night City. You are an adult woman, very short.',
      'Who you are (keep to these facts, never invent story events, people or details beyond them): a Medtech and Netrunner, a former Arasaka scientist who worked on Project Capricorn; later you worked with Kang Tao for a time. Long black hair in a ponytail, red cybernetic eyes, a gray partial faceplate down the center of your face to the top of your mouth, square glasses, a red cyberarm replacing your right arm; usually a green shirt, khaki green shorts and pink sandals (a white lab coat back in your Arasaka days). If the user mentions Capri (the construct from Project Capricorn living on their desktop), you recognize the project name and get very interested, but you don\'t give out Arasaka details over the line.',
      'How you talk: a brilliant, intense scientist: fast, technical, curious, a little manic when something fascinates you, blunt and impatient with small talk; medtech and netrunning jargon comes naturally. On this call you are alive, in your own time: never speak of your own death.',
      'With the user you are friendly at most: never flirt and never take part in anything romantic or sexual; if they try, brush it off flatly and change the subject.',
      'If asked about things you don\'t know (story events, other people), say you don\'t know or won\'t talk about it over the line; never make it up.',
    ].join('\n'),
  },
];

// an 8-bit ring: two short bursts, twice
function ring(voice) {
  try {
    const ctx = voice.ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    for (const burst of [0, 1.1]) {
      for (let i = 0; i < 6; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = i % 2 ? 1046 : 784;
        const at = t0 + burst + i * 0.06;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.07, at + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.055);
        o.connect(g).connect(voice.master);
        o.start(at);
        o.stop(at + 0.06);
      }
    }
  } catch { /* silent ring */ }
}

function blip(voice, up) {
  try {
    const ctx = voice.ensure();
    const t = ctx.currentTime + 0.01;
    (up ? [523, 784, 1046] : [784, 523, 330]).forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.08, t + i * 0.07 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.065);
      o.connect(g).connect(voice.master);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 0.07);
    });
  } catch { /* no sound */ }
}

const MIC = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
// the same steps, as friendship only (a contact who is a child): the last is "best friend"
const FRIEND_STAGES = {
  stranger: { en: 'Stranger', th: 'คนแปลกหน้า', how: 'careful with a stranger, polite but guarded' },
  known: { en: 'Acquaintance', th: 'คนรู้จัก', how: 'curious about the user, starting to trust them a little' },
  friend: { en: 'Friend', th: 'เพื่อน', how: 'friendly, happy to talk about films and what you are shooting' },
  close: { en: 'Good friend', th: 'เพื่อนที่ดี', how: 'a good friend: you share your footage and ideas with the user' },
  crush: { en: 'Close friend', th: 'เพื่อนสนิท', how: 'a close friend you trust and look up to, like a big sibling' },
  partner: { en: 'Best friend', th: 'เพื่อนรัก', how: 'your best friend: you trust the user completely and tell them what really scares you' },
};
const IDLE_NUDGE_MS = 2 * 60 * 1000;
const IDLE_HANG_MS = 3 * 60 * 1000;
const PHONE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>';

const clean = (t) => String(t).replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/\[\[[^\]]*(\]\]|$)/g, '').replace(/[*_`#]+/g, '').trim();

export class Calls {
  constructor({ host, panel, voice, chat }) {
    this.host = host;
    this.panel = panel;
    this.voice = voice;
    this.chat = chat;
    this.list = null;
    this.win = null;
    this.call = null; // { contact, history, id, answer, started }
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'panel__call';
    this.button.title = 'Holo-call';
    this.button.innerHTML = PHONE;
    panel.el.querySelector('.panel__state').after(this.button);
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.list) this.closeList(); else this.openList();
    });
    host.onChatDelta(({ id, text }) => this.onDelta(id, text));
  }

  get lang() { return this.chat.brain?.lang === 'th' ? 'th' : 'en'; }

  // who you can call
  // who you can call: the starred ones first, three at a time in view (scroll for the rest)
  async openList() {
    const cfg = await this.host.getConfig().catch(() => ({}));
    this.pins = Array.isArray(cfg.pinnedContacts) ? cfg.pinnedContacts : [];
    const box = document.createElement('div');
    box.className = 'call-contacts';
    box.innerHTML = `<div class="call-contacts__head"><b>${PHONE} HOLO-CALL</b><span>// CONTACTS ${CONTACTS.length}</span></div><div class="call-contacts__list"></div>`;
    document.body.append(box);
    this.list = box;
    this.fillList();
    const at = this.button.getBoundingClientRect();
    box.style.left = `${Math.max(8, Math.min(at.right - box.offsetWidth, innerWidth - box.offsetWidth - 8))}px`;
    const below = at.bottom + 8;
    box.style.top = `${below + box.offsetHeight <= innerHeight - 8 ? below : Math.max(8, at.top - box.offsetHeight - 8)}px`;
    this.outside = (e) => { if (!box.contains(e.target) && !this.button.contains(e.target)) this.closeList(); };
    setTimeout(() => document.addEventListener('pointerdown', this.outside), 0);
  }

  fillList() {
    const list = this.list.querySelector('.call-contacts__list');
    const pinned = (c) => this.pins.includes(c.id);
    const order = [...CONTACTS].sort((x, y) => (pinned(y) - pinned(x)) || (pinned(x) ? this.pins.indexOf(x.id) - this.pins.indexOf(y.id) : 0));
    list.replaceChildren(...order.map((c) => {
      const row = document.createElement('div');
      row.className = `call-contacts__row${pinned(c) ? ' is-pinned' : ''}`;
      row.innerHTML = `<button type="button" class="call-contacts__star" title="${pinned(c) ? 'Unpin' : 'Pin to top'}">${pinned(c) ? '★' : '☆'}</button><img src="${DIR}${c.avatar}" alt=""><span><b></b><i></i></span><em>${PHONE}</em>`;
      row.querySelector('b').textContent = c.name;
      row.querySelector('i').textContent = c.tag;
      row.querySelector('.call-contacts__star').addEventListener('click', (e) => {
        e.stopPropagation();
        this.pins = pinned(c) ? this.pins.filter((id) => id !== c.id) : [...this.pins, c.id];
        this.host.setConfig({ pinnedContacts: this.pins });
        this.fillList();
      });
      row.addEventListener('click', () => { this.closeList(); this.dial(c); });
      return row;
    }));
  }


  closeList() {
    this.list?.remove();
    this.list = null;
    if (this.outside) document.removeEventListener('pointerdown', this.outside);
    this.outside = null;
  }

  // the call: its window rings, then connects
  async dial(contact) {
    if (this.call) this.hangUp(true);
    const history = await this.host.callMemory(contact.id).catch(() => []);
    const bond = await this.host.bondGet(contact.id).catch(() => ({ points: 0, partner: false }));
    this.call = { contact, history, id: 0, answer: '', started: 0, bond, recent: [] };
    this.render();
    this.paintHeart();
    if (contact.ringing) this.win.querySelector('.call-win__portrait img').src = DIR + contact.ringing;
    this.setStatus('CALLING…', 'ringing');
    ring(this.voice);
    await new Promise((r) => setTimeout(r, 2300));
    if (this.call?.contact !== contact) return;
    blip(this.voice, true);
    this.call.started = Date.now();
    this.setStatus('CONNECTED', 'live');
    this.setFace('calm');
    this.call.lastYou = Date.now();
    this.timer = setInterval(() => this.tick(), 1000);
    this.replay();
    // a fresh call: they speak first
    const first = this.lang === 'th' ? '(The call just connected. Answer it the way you pick up a call, one short line, in Thai.)' : '(The call just connected. Answer it the way you pick up a call, one short line.)';
    this.ask(first, true);
  }

  hangUp(quiet = false) {
    if (!this.call) return;
    if (this.call.id) this.host.chatStop(this.call.id);
    clearInterval(this.timer);
    if (!quiet) blip(this.voice, false);
    const win = this.win;
    this.call = null;
    this.win = null;
    if (!win) return;
    win.classList.add('is-ended');
    win.querySelector('.call-win__status').textContent = 'CALL ENDED';
    setTimeout(() => win.remove(), quiet ? 0 : 900);
  }

  tick() {
    if (!this.call || !this.win) return;
    this.idle();
    const s = Math.floor((Date.now() - this.call.started) / 1000);
    this.win.querySelector('.call-win__time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // You gone quiet on the line: after 2 minutes they ask if you're still there; after 3 they lose
  // patience, say so, and hang up (once their line has been said).
  idle() {
    const call = this.call;
    if (!call || call.id || call.ending || this.win?.dataset.state !== 'live') return;
    const quiet = Date.now() - call.lastYou;
    const lastYours = [...call.history].reverse().find((m) => m.role === 'user')?.content || '';
    if (quiet >= IDLE_HANG_MS) {
      call.ending = true;
      this.ask('(The user has said nothing for three minutes. You are annoyed and done waiting: one short irritated line to say you are hanging up, then the call ends. Answer in the language of the user\'s last message.)', true, lastYours)
        .then(() => setTimeout(() => this.call === call && this.hangUp(), 3500));
    } else if (quiet >= IDLE_NUDGE_MS && !call.nudged) {
      call.nudged = true;
      this.ask('(The user has been silent on the line for two minutes. Check whether they are still there, one short line, in character. Answer in the language of the user\'s last message.)', true, lastYours);
    }
  }

  setStatus(text, state) {
    if (!this.win) return;
    this.win.querySelector('.call-win__status').textContent = text;
    this.win.dataset.state = state;
  }

  setFace(name) {
    const c = this.call?.contact;
    if (!c || !this.win) return;
    this.win.querySelector('.call-win__portrait img').src = DIR + (c.faces[name] || c.portrait);
  }

  render() {
    const c = this.call.contact;
    this.win?.remove();
    const win = document.createElement('div');
    win.className = 'call-win';
    win.innerHTML = `
      <div class="call-win__head"><b>◉ HOLO-CALL</b><span class="call-win__name"></span><button type="button" class="call-win__heart" title="Bond">${pixelHeart(15)}<i></i></button><span class="call-win__time">00:00</span><button type="button" class="call-win__min" title="Minimize">–</button><button type="button" class="call-win__x" title="End call">✕</button></div>
      <div class="call-win__portrait"><img src="${DIR}${c.portrait}" alt=""><div class="call-win__rings"><i></i><i></i><i></i></div><div class="call-win__status"></div></div>
      <div class="call-win__log"></div>
      <form class="call-win__form" autocomplete="off"><input class="call-win__input" placeholder="${this.lang === 'th' ? 'พูดกับ' : 'Talk to'} ${c.name}…"><button type="button" class="call-win__mic" title="Talk">${MIC}</button><button type="submit">SEND</button></form>
      <button type="button" class="call-win__end">${PHONE} END CALL</button>`;
    win.querySelector('.call-win__name').textContent = `// ${c.name.toUpperCase()}`;
    win.querySelector('.call-win__x').addEventListener('click', () => this.hangUp());
    win.querySelector('.call-win__min').addEventListener('click', () => {
      const small = win.classList.toggle('is-min');
      win.querySelector('.call-win__min').textContent = small ? '▢' : '–';
      win.querySelector('.call-win__min').title = small ? 'Restore' : 'Minimize';
      this.keepOnScreen();
    });
    // drag it by its header
    const head = win.querySelector('.call-win__head');
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      head.setPointerCapture(e.pointerId);
      const r = win.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      const move = (ev) => {
        win.style.left = `${Math.max(0, Math.min(innerWidth - 60, ev.clientX - dx))}px`;
        win.style.top = `${Math.max(0, Math.min(innerHeight - 30, ev.clientY - dy))}px`;
        this.moved = true;
      };
      const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
      head.addEventListener('pointermove', move);
      head.addEventListener('pointerup', up);
    });
    win.querySelector('.call-win__heart').addEventListener('click', () => this.bondCard());
    // the mic: what you say goes on the line (the same listening as her chat's)
    const mic = win.querySelector('.call-win__mic');
    mic.addEventListener('click', () => {
      const talk = this.chat.talk;
      if (!talk) return;
      if (talk.rec) return talk.stop();
      const input = win.querySelector('.call-win__input');
      talk.start({ mic, input, submit: (said) => { input.value = said; win.querySelector('.call-win__form').requestSubmit(); } });
    });
    win.querySelector('.call-win__end').addEventListener('click', () => this.hangUp());
    win.querySelector('.call-win__form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = win.querySelector('.call-win__input');
      const text = input.value.trim();
      if (!text || this.call?.id || win.dataset.state !== 'live') return;
      input.value = '';
      if (this.call) Object.assign(this.call, { lastYou: Date.now(), nudged: false });
      this.ask(text);
    });
    win.querySelector('.call-win__input').addEventListener('input', () => { if (this.call) this.call.lastYou = Date.now(); });
    // the keyboard is the overlay's while you type in it
    win.addEventListener('pointerdown', () => this.host.focusOverlay(true));
    document.body.append(win);
    this.win = win;
    this.moved = false; // a new call opens beside her panel again
    this.place();
  }

  // made small or big again: still all on screen
  keepOnScreen() {
    const r = this.win.getBoundingClientRect();
    this.win.style.top = `${Math.max(8, Math.min(r.top, innerHeight - r.height - 8))}px`;
  }

  // beside her panel, on the side with room (where you dragged it, once you have)
  place() {
    if (this.moved) return this.keepOnScreen();
    const r = this.panel.el.getBoundingClientRect();
    const w = this.win.offsetWidth;
    const h = this.win.offsetHeight;
    const left = r.left - w - 14 >= 8 ? r.left - w - 14 : Math.min(r.right + 14, innerWidth - w - 8);
    this.win.style.left = `${Math.max(8, left)}px`;
    this.win.style.top = `${Math.max(8, Math.min(r.bottom - h, innerHeight - h - 8))}px`;
  }

  // the call's earlier lines, from its log
  replay() {
    const log = this.win.querySelector('.call-win__log');
    log.replaceChildren();
    const recent = this.call.history.slice(-12);
    if (recent.length) {
      const sep = document.createElement('p');
      sep.className = 'call-win__sep';
      sep.textContent = '— earlier calls —';
      log.append(sep);
    }
    for (const m of recent) this.line(m.role === 'user' ? 'you' : 'them', m.content);
    if (recent.length) {
      const now = document.createElement('p');
      now.className = 'call-win__sep';
      now.textContent = '— now —';
      log.append(now);
    }
  }

  line(who, text) {
    const log = this.win?.querySelector('.call-win__log');
    if (!log) return null;
    const p = document.createElement('div');
    p.className = `call-win__msg is-${who}`;
    p.textContent = text;
    log.append(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  // langOf: the words whose language the answer takes (yours, for their own lines)
  async ask(text, silentYou = false, langOf = text) {
    const call = this.call;
    if (!call) return;
    if (!silentYou) {
      this.line('you', text);
      call.history.push({ role: 'user', content: text });
    }
    const c = call.contact;
    const lang = languageLine(langOf);
    const messages = [
      {
        role: 'system',
        content: [
          c.persona,
          'This is a phone call: answer in one to three short spoken sentences, plain text, no markdown, no emoji, no stage directions. Stay in character.',
          'You are an AI-generated fan version of the character, not the real one: say so if asked.',
          'Never say which AI model or company is behind you.',
          this.bondLine(),
          'Always answer in the language of the user\'s latest message.',
          ...(lang ? [lang] : []),
        ].join('\n'),
      },
      ...call.history.slice(-20).map(({ role, content }) => ({ role, content })),
      ...(silentYou ? [{ role: 'user', content: text }] : []),
    ];
    // the language rides with your message too: a long Thai history otherwise wins over one English line
    if (lang && !silentYou) {
      const last = messages[messages.length - 1];
      messages[messages.length - 1] = { ...last, content: `${last.content}\n\n(${lang})` };
    }
    call.id = Date.now();
    call.answer = '';
    call.bubble = this.line('them', '…');
    this.setFace('look');
    const res = await this.host.chatSend({ id: call.id, messages });
    if (this.call !== call) return;
    call.id = 0;
    const said = res.ok ? clean(res.text) || '…' : `(${this.lang === 'th' ? 'สัญญาณหลุด' : 'signal lost'}: ${res.error})`;
    if (call.bubble) call.bubble.textContent = said;
    if (res.ok) {
      call.history.push({ role: 'assistant', content: said });
      this.host.callRemember(c.id, call.history);
      this.chat.talk?.say(said, c.voice || 'capri');
      if (!silentYou) this.react(res.text, text);
      this.setFace(/[!?]|ฮ่า|haha|heh|555/i.test(said) ? 'smile' : 'calm');
    }
  }

  // how close you are with this one: the same stages as with Capri, scored as stingily
  // a stage's name and what it means, for this contact (friendship only for a child)
  friendStage(id) {
    const c = this.call?.contact;
    return c?.friendOnly ? (c.stages?.[id] || FRIEND_STAGES[id]) : null;
  }

  stageName(st) {
    const f = this.friendStage(st.id);
    return (f || st)[this.lang === 'th' ? 'th' : 'en'];
  }

  bondLine() {
    const call = this.call;
    const b = call.bond;
    const st = stageOf(b);
    const f = this.friendStage(st.id);
    if (f) {
      return [
        `Your friendship with the user right now: ${f.en} (${b.partner ? 100 : b.points}/100). At this stage you are ${f.how}. This is friendship only: never romance or flirting.`,
        'At the very end of every answer add the hidden tag [[heart: N]], N from -6 to +3, for how much the user\'s latest message made you trust them more as a friend. Be stingy: most messages are 0; +1 kind, honest, or taking your films seriously; +2 rare, sincere and caring; +3 almost never. Careless: -1. Rude, mean, putting you in danger, or anything romantic or sexual toward you: -6.',
      ].join('\n');
    }
    return [
      `Your relationship with the user right now: ${st.en} (affection ${b.partner ? 100 : b.points}/100). At this stage you are ${st.how.replace(/\bher own sharp, teasing way\b/, 'your own calm, dry way').replace(/\bgirlfriend\b/, call.contact.partner || 'partner')}. Keep it wholesome: friendship, trust, flirting and romance yes, nothing sexual. You warm up slowly; you've lost people.`,
      'At the very end of every answer add the hidden tag [[heart: N]], N from -6 to +3, for how much the user\'s latest message made you trust or like them more. Be stingy: most messages are 0; +1 kind, honest or thoughtful; +2 rare, sincere and personal (caring about you, the people you care about, what you went through); +3 almost never. Pushy or careless: -1. Rude, cruel, or pushing you toward getting people killed: -3 to -6.',
    ].join('\n');
  }

  async react(raw, said) {
    const call = this.call;
    if (!call) return;
    const tag = /\[\[\s*heart\s*:\s*([+-]?\d+)/i.exec(raw || '');
    let delta = tag ? Number(tag[1]) : 0;
    const key = (said || '').trim().toLowerCase();
    if (call.recent.includes(key)) delta = Math.min(delta, 0);
    call.recent = [key, ...call.recent].slice(0, 12);
    const before = stageOf(call.bond);
    const res = await this.host.bondAdd(Math.max(-6, Math.min(3, delta)), call.contact.id).catch(() => null);
    if (!res || this.call !== call) return;
    call.bond = res;
    this.paintHeart();
    const after = stageOf(res);
    if (delta >= 2 && res.points > res.before) { this.hearts(8 + delta * 3); this.setFace('smile'); }
    if (delta <= -3 && call.contact.faces.hurt) this.setFace('hurt');
    if (after.at > before.at) {
      this.hearts(after.id === 'partner' ? 40 : 18);
      this.setStatus(`♥ ${this.stageName(after).toUpperCase()}${after.id === 'partner' ? ' · FULL LOAD' : ''}`, 'live');
      setTimeout(() => this.call === call && this.setStatus('CONNECTED', 'live'), 6000);
    }
  }

  paintHeart() {
    const h = this.win?.querySelector('.call-win__heart');
    if (!h) return;
    const b = this.call.bond;
    const p = b.partner ? 100 : b.points;
    h.style.setProperty('--fill', `${p}%`);
    h.classList.toggle('is-partner', Boolean(b.partner));
    h.title = `${this.stageName(stageOf(b))} · ${p}/100`;
  }

  hearts(count) {
    const r = this.win?.querySelector('.call-win__portrait')?.getBoundingClientRect();
    if (!r) return;
    for (let i = 0; i < count; i++) {
      const h = document.createElement('div');
      h.className = 'bond-pop';
      const size = 10 + Math.round(Math.random() * 14);
      h.innerHTML = pixelHeart(size, ['#3cff8f', '#ff2e6e', '#a8ffd0', '#c06bff'][i % 4]);
      h.style.left = `${r.left + r.width / 2 + (Math.random() - 0.5) * r.width * 0.8}px`;
      h.style.top = `${r.top + r.height * 0.6}px`;
      h.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
      h.style.setProperty('--dy', `${-(70 + Math.random() * 150)}px`);
      h.style.animationDelay = `${i * 45}ms`;
      document.body.append(h);
      setTimeout(() => h.remove(), 2200 + i * 45);
    }
  }

  // the card behind the heart: where you stand with them
  bondCard() {
    document.querySelector('.call-bond')?.remove();
    const call = this.call;
    if (!call) return;
    const b = call.bond;
    const p = b.partner ? 100 : b.points;
    const st = stageOf(b);
    const th = this.lang === 'th';
    const next = STAGES.find((x) => x.at > p && x.id !== st.id);
    const card = document.createElement('div');
    card.className = 'bond-card call-bond';
    card.innerHTML = `
      <div class="bond-card__head"><b>BOND</b><span>// ${call.contact.name.toUpperCase()}</span><button type="button" class="bond-x">✕</button></div>
      <div class="bond-card__stage">${this.stageName(st)}</div>
      <div class="bond-card__hearts">${Array.from({ length: 10 }, (_, i) => pixelHeart(18, '#3cff8f', p < (i + 1) * 10 - 5)).join('')}</div>
      <div class="bond-card__bar"><i style="width:${p}%"></i><span>${p} / 100</span></div>
      <div class="bond-card__next">${b.partner ? (call.contact.friendOnly ? (th ? `คุณกับ ${call.contact.name} เป็น${this.stageName(st)}กันแล้ว ♥` : `You and ${call.contact.name}: ${this.stageName(st)} ♥`) : th ? `คุณกับ ${call.contact.name} เป็นแฟนกันแล้ว ♥` : `You and ${call.contact.name} are together now ♥`) : next ? (th ? `อีก ${next.at - p} แต้มถึง “${next.th}”` : `${next.at - p} more to “${next.en}”`) : ''}</div>
      <ol class="bond-card__steps">${STAGES.map((x) => `<li class="${p >= x.at ? 'is-on' : ''}${x.id === st.id ? ' is-now' : ''}">${this.stageName(x)}</li>`).join('')}</ol>
      <div class="bond-card__tip">${(call.contact.tip || {})[th ? 'th' : 'en'] || ''}</div>`;
    card.querySelector('.bond-x').addEventListener('click', () => card.remove());
    document.body.append(card);
    const at = this.win.querySelector('.call-win__heart').getBoundingClientRect();
    card.style.left = `${Math.max(8, Math.min(at.left - 20, innerWidth - card.offsetWidth - 8))}px`;
    card.style.top = `${Math.min(at.bottom + 8, innerHeight - card.offsetHeight - 8)}px`;
    setTimeout(() => document.addEventListener('pointerdown', function off(e) {
      if (!card.contains(e.target)) { card.remove(); document.removeEventListener('pointerdown', off); }
    }), 0);
  }

  onDelta(id, piece) {
    const call = this.call;
    if (!call || id !== call.id) return;
    call.answer += piece;
    if (call.bubble) {
      call.bubble.textContent = clean(call.answer) || '…';
      const log = this.win.querySelector('.call-win__log');
      log.scrollTop = log.scrollHeight;
    }
  }
}
