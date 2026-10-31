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
  revive: { name: 'Électrochoc', desc: 'Tu ramènes un monstre exorcisé dans le camp des monstres.' },
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

// L'évasion : chaque énigme a pour réponse un chiffre du cadenas.
// L'ultime énigme donne l'ordre des symboles, en devinettes : la tête sans chair (crâne),
// ce qui change l'homme en loup (lune), ce qui voit tout (œil), ce qui brûlait les sorcières (flamme)
// → crâne, lune, œil, flamme → 2 6 3 9.
export const DEFAULT_ESCAPE = {
  code: '2639',
  order: ['skull', 'moon', 'eye', 'flame'],
  ultimate: 'Quatre gardiens dorment sur la porte. Lis le code dans l\'ordre de leur réveil.\nCelui qui change l\'homme en loup ne se lève qu\'après que la tête sans chair a parlé.\nCelui qui brûlait les sorcières s\'allume le dernier, quand tous les autres le regardent.\nCelui qui voit tout n\'ouvre ses paupières qu\'une fois le loup réveillé.',
  enigmas: [
    {
      num: '13', room: 'Salon', sym: 'skull',
      q: 'Devant le miroir, il faut prononcer son nom cinq fois pour qu\'il vienne avec son crochet. Pour faire sortir l\'autre de sa maquette, trois fois suffisent. Combien de fois de plus faut-il appeler le premier que le second ?',
      answers: ['2', 'deux'],
      hint: 'Le premier, c\'est Candyman. Le second, Beetlejuice.',
    },
    {
      num: '237', room: 'Salon', sym: 'moon',
      q: 'Additionne les chiffres de la chambre interdite de l\'hôtel Overlook, puis divise par le nombre de sœurs qui attendent Danny au bout du couloir.',
      answers: ['6', 'six'],
      hint: 'La chambre interdite porte le numéro de cette carte. Les sœurs, ce sont les jumelles de Shining.',
    },
    {
      num: '666', room: 'Cuisine', sym: 'eye',
      q: 'Prends le jour du mois où Jason frappe à Crystal Lake. Retire le dernier nombre de la comptine que chantent les fillettes quand Freddy approche. Que reste-t-il ?',
      answers: ['3', 'trois'],
      hint: 'Vendredi 13. La comptine commence par « Un, deux, Freddy te coupe en deux » et s\'arrête à dix.',
    },
    {
      num: '1408', room: 'Cuisine', sym: 'flame',
      q: 'Combien de jours te reste-t-il à vivre après avoir regardé la cassette maudite ? Ajoute le nombre de tueurs cachés sous le masque de Ghostface dans le premier Scream.',
      answers: ['9', 'neuf'],
      hint: 'The Ring : sept jours. Scream : Billy et Stu.',
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
  refugeR: 40, safeR: 100, clueAt: [20, 16, 12, 8, 4], readSecs: 15, mapStyle: 'nuit',
};

// Styles de carte proposés au MJ (fonds sans clé)
export const MAP_STYLES = {
  nuit: 'Nuit orange',
  satellite: 'Satellite de nuit',
  plan: 'Plan détaillé',
  gris: 'Gris foncé',
};

// Loup-garou : rôles classiques
export const ROLES = {
  loup: { name: 'Loup-garou', team: 'loups', desc: 'Chaque nuit, avec les autres loups, dévore un villageois. Le jour, fais-toi passer pour un innocent.' },
  voyante: { name: 'Voyante', team: 'village', desc: 'Chaque nuit, découvre le vrai rôle d\'un joueur.' },
  sorciere: { name: 'Sorcière', team: 'village', desc: 'Une potion de vie pour sauver la victime des loups, une potion de mort pour éliminer quelqu\'un. Une seule fois chacune.' },
  chasseur: { name: 'Chasseur', team: 'village', desc: 'Si tu meurs, tu emportes immédiatement quelqu\'un avec toi.' },
  villageois: { name: 'Villageois', team: 'village', desc: 'Démasque les loups pendant les débats et vote pour les éliminer.' },
};
