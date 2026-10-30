// Contenus de la partie : monstres, pouvoirs, énigmes, indices du refuge, rôles du loup-garou.

// Pouvoirs utilisables une fois pendant l'alerte générale ou le refuge
export const POWERS = {
  decoy: { name: 'Sac de farces', desc: 'Au prochain signalement, deux faux toi apparaissent sur la carte des chasseurs.' },
  fake: { name: 'Appel anonyme', desc: 'Au prochain signalement, les chasseurs reçoivent une fausse position à ton nom.' },
  hide: { name: 'La Forme', desc: 'Tu disparais du prochain signalement.' },
  hide5: { name: 'Nuée', desc: 'Ta position est cachée aux chasseurs pendant 5 minutes, même hors zone.' },
  blind: { name: 'Ne t\'endors pas', desc: 'La carte des chasseurs devient noire pendant 1 minute.' },
  immune: { name: 'Il revient toujours', desc: 'Ta première capture ne compte pas : tu te relèves. Pouvoir automatique.' },
  swap: { name: 'Transfert d\'âme', desc: 'Au prochain signalement, ta position est échangée avec celle d\'un autre monstre.' },
  see: { name: 'On flotte tous', desc: 'Tu vois la position des chasseurs pendant 30 secondes.' },
  delay: { name: 'Prière noire', desc: 'Le prochain signalement de tous les monstres est retardé de 2 minutes.' },
  revive: { name: 'Électrochoc', desc: 'Tu ramènes un binôme exorcisé dans le camp des monstres.' },
  clue: { name: 'Boule de cristal', desc: 'Au refuge, tu lis le prochain indice avant tout le monde.' },
};

export const MONSTERS = [
  { name: 'Art le Clown', film: 'Terrifier', power: 'decoy' },
  { name: 'Ghostface', film: 'Scream', power: 'fake' },
  { name: 'Michael Myers', film: 'Halloween', power: 'hide' },
  { name: 'Freddy Krueger', film: 'Les Griffes de la nuit', power: 'blind' },
  { name: 'Jason Voorhees', film: 'Vendredi 13', power: 'immune' },
  { name: 'Chucky', film: 'Jeu d\'enfant', power: 'swap' },
  { name: 'Grippe-Sou', film: 'Ça', power: 'see' },
  { name: 'Samara', film: 'The Ring', power: 'delay' },
  { name: 'Annabelle', film: 'Annabelle', power: 'hide5' },
  { name: 'La Nonne', film: 'La Nonne', power: 'delay' },
  { name: 'Pinhead', film: 'Hellraiser', power: 'blind' },
  { name: 'Leatherface', film: 'Massacre à la tronçonneuse', power: 'fake' },
  { name: 'Jigsaw', film: 'Saw', power: 'decoy' },
  { name: 'Regan', film: 'L\'Exorciste', power: 'swap' },
  { name: 'Candyman', film: 'Candyman', power: 'see' },
  { name: 'M3GAN', film: 'M3GAN', power: 'see' },
  { name: 'Dracula', film: 'Vampire', power: 'hide5' },
  { name: 'Frankenstein', film: 'Créature', power: 'revive' },
  { name: 'Loup-garou', film: 'Créature', power: 'see' },
  { name: 'La Momie', film: 'Créature', power: 'blind' },
  { name: 'Zombie', film: 'Mort-vivant', power: 'hide' },
  { name: 'Sorcière', film: 'Magie noire', power: 'clue' },
];

export const CUSTOM_POWERS = ['hide', 'decoy', 'fake', 'see', 'hide5', 'blind'];

// Symboles des chiffres du cadenas (ordre donné par l'ultime énigme)
export const SYMBOLS = { skull: 'Le crâne', moon: 'La lune', eye: 'L\'œil', flame: 'La flamme' };

export const DEFAULT_ESCAPE = {
  code: '3618',
  order: ['skull', 'moon', 'eye', 'flame'],
  ultimate: 'Le crâne ouvre la marche. La lune se lève avant que l\'œil ne s\'ouvre. La flamme, elle, s\'éteint toujours en dernier.',
  enigmas: [
    {
      num: '237', room: 'Salon', sym: 'skull',
      q: 'Au bout du couloir de l\'Overlook, deux sœurs attendent Danny. Multiplie le numéro de la chambre interdite par le nombre de sœurs, puis additionne les chiffres du résultat.',
      answers: ['15', 'quinze'],
      hint: 'La chambre interdite porte le numéro de cette carte.',
    },
    {
      num: '666', room: 'Buanderie', sym: 'flame',
      q: 'Chaque lettre de ce message a été décalée d\'un cran dans l\'alphabet. Décode le nom de celui qui rôde : NJDIBFM NZFST',
      answers: ['michael myers', 'myers', 'michael'],
      hint: 'Le N devient M, le J devient I…',
    },
    {
      num: '1408', room: 'Cuisine', sym: 'eye',
      q: 'Plus il y a de lumière, plus je suis nette. Dans le noir complet, je disparais. Je te suis partout sans jamais faire de bruit. Qui suis-je ?',
      answers: ['ombre', 'ton ombre', 'mon ombre', 'l\'ombre', 'une ombre'],
      hint: 'Regarde à tes pieds, près d\'une lampe.',
    },
    {
      num: '13', room: 'Entrée', sym: 'moon',
      q: 'Une petite fille, assise devant une télévision qui grésille, se retourne et annonce : « Ils sont là. » De quel film parle-t-on ?',
      answers: ['poltergeist'],
      hint: 'Un film de 1982 produit par Steven Spielberg.',
    },
  ],
};

// Indices d'exemple : les vrais se tapent dans le panneau du MJ et restent sur l'écran TV,
// pour que le lieu du rendez-vous n'apparaisse jamais dans le code public.
export const DEFAULT_CLUES = [
  'Indice 1 : à écrire dans le panneau du maître du jeu.',
  'Indice 2 : à écrire dans le panneau du maître du jeu.',
  'Indice 3 : à écrire dans le panneau du maître du jeu.',
  'Indice 4 : à écrire dans le panneau du maître du jeu.',
  'Indice 5 : à écrire dans le panneau du maître du jeu.',
];

export const DEFAULT_CFG = {
  evasion: 30, alerte: 30, refuge: 20, every: 5, radius: 1000,
  refugeR: 40, safeR: 100, clueAt: [20, 16, 12, 8, 4], readSecs: 15,
};

// Loup-garou : rôles classiques
export const ROLES = {
  loup: { name: 'Loup-garou', team: 'loups', desc: 'Chaque nuit, avec les autres loups, dévore un villageois. Le jour, fais-toi passer pour un innocent.' },
  voyante: { name: 'Voyante', team: 'village', desc: 'Chaque nuit, découvre le vrai rôle d\'un joueur.' },
  sorciere: { name: 'Sorcière', team: 'village', desc: 'Une potion de vie pour sauver la victime des loups, une potion de mort pour éliminer quelqu\'un. Une seule fois chacune.' },
  chasseur: { name: 'Chasseur', team: 'village', desc: 'Si tu meurs, tu emportes immédiatement quelqu\'un avec toi.' },
  villageois: { name: 'Villageois', team: 'village', desc: 'Démasque les loups pendant les débats et vote pour les éliminer.' },
};
