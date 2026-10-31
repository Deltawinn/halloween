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
export const SYMBOLS = { skull: 'Le crâne', moon: 'La lune', eye: 'L\'œil', flame: 'La flamme', ghost: 'Le fantôme' };

// L'évasion : 5 cartes numérotées cachées dans le salon et la cuisine. Au lancement, l'appli tire au sort
// 5 énigmes dans la réserve de 20 et les attache aux cartes. Chaque bonne réponse révèle un chiffre et son
// symbole. Quatre symboles forment le code ; le cinquième (le fantôme) est un leurre que l'ultime énigme ignore.

export const DEFAULT_ESCAPE = {
  code: '2639',
  // chaque énigme résolue révèle un fragment ; dans l'ordre des symboles, ils donnent la cachette des clés
  fragments: ['Beau', 'Ko', '2', 'Ri'],
  final: 'le bocal de riz',
  finalAnswers: ['bocal de riz', 'bocal', 'bocal a riz', 'pot de riz', 'bokal de riz', 'beau ko 2 ri', 'bo ko de ri'],
  order: ['skull', 'moon', 'eye', 'flame'],
  count: 5, // 4 vraies énigmes + 1 carte leurre dont l'énigme n'a pas de bonne réponse
  cards: [
    { num: '13', room: 'Salon' },
    { num: '237', room: 'Salon' },
    { num: '666', room: 'Cuisine' },
    { num: '1408', room: 'Cuisine' },
    { num: '1428', room: 'Salon' },
  ],
  ultimate: 'Quatre gardiens dorment sur la porte. Lis leurs fragments dans l\'ordre de leur réveil : ils te diront où dorment les clés.\nCelui qui change l\'homme en loup ne se lève qu\'après que la tête sans chair a parlé.\nCelui qui brûlait les sorcières s\'allume le dernier, quand tous les autres le regardent.\nCelui qui voit tout n\'ouvre ses paupières qu\'une fois le loup réveillé.',
  enigmas: [],
};

// La réserve de 20 énigmes (tirées au sort à chaque partie)
export const ENIGMA_POOL = [
  { q: 'Je vis dans les égouts de Derry, je flotte avec mes ballons rouges et je me réveille tous les 27 ans. Qui suis-je ?', answers: ['grippe sou', 'grippesou', 'pennywise', 'ca'], hint: 'Un clown, dans un roman de Stephen King.' },
  { q: 'Dans « Shining », quel est le numéro de la chambre de l’hôtel Overlook où Danny n’aurait jamais dû entrer ?', answers: ['237'], hint: 'Trois chiffres. Leur somme fait 12.' },
  { q: 'Tu viens de regarder la cassette maudite et le téléphone sonne. Combien de jours te reste-t-il à vivre ?', answers: ['7', 'sept'], hint: 'The Ring. Une semaine.' },
  { q: 'Une maison neuve, une télévision qui grésille, et une fillette qui se retourne pour annoncer « Ils sont là ». Quel film ?', answers: ['poltergeist'], hint: 'Un film de 1982 produit par Steven Spielberg.' },
  { q: 'Dis son nom cinq fois face au miroir et il apparaît derrière toi, un crochet à la place de la main. Qui est-il ?', answers: ['candyman'], hint: 'Son nom évoque des bonbons.' },
  { q: 'Le tueur Charles Lee Ray a transféré son âme dans une poupée « Brave Gars ». Comment s’appelle-t-elle ?', answers: ['chucky'], hint: '« Jeu d’enfant », 1988.' },
  { q: 'Dans « Psychose », comment s’appelle le gérant timide du motel qui parle beaucoup de sa mère ?', answers: ['norman bates', 'bates', 'norman'], hint: 'Le motel porte son nom de famille.' },
  { q: 'Pull rayé rouge et vert, chapeau, gant à lames. Qui hante les rêves des adolescents d’Elm Street ?', answers: ['freddy', 'krueger', 'freddy krueger'], hint: '« Les Griffes de la nuit ».' },
  { q: 'Quel jour de la semaine Jason Voorhees est-il réputé frapper à Crystal Lake ?', answers: ['vendredi'], hint: 'Le titre du film contient aussi le chiffre 13.' },
  { q: 'Le masque de Ghostface dans « Scream » est inspiré d’un tableau célèbre. Lequel ? (le titre ou le peintre)', answers: ['le cri', 'cri', 'munch', 'edvard munch'], hint: 'Un tableau norvégien de 1893.' },
  { q: 'Pour garder un Mogwai, il ne faut pas le mouiller, pas l’exposer à la lumière… et surtout, quoi faire après minuit ?', answers: ['nourrir', 'le nourrir', 'manger', 'nourriture'], hint: 'Gremlins : c’est une question de repas.' },
  { q: 'Dans « L’Exorciste », quel est le prénom de la fillette de 12 ans possédée par un démon ?', answers: ['regan'], hint: 'Son nom de famille est MacNeil.' },
  { q: 'Dans « Hellraiser », comment surnomme-t-on le chef des cénobites, au crâne hérissé de clous ?', answers: ['pinhead'], hint: 'Son surnom anglais évoque des épingles.' },
  { q: 'En 1999, trois étudiants partent filmer une légende dans une forêt du Maryland et ne reviennent jamais. Quel film ?', answers: ['blair witch', 'projet blair witch', 'le projet blair witch', 'blair'], hint: 'Le nom d’une sorcière.' },
  { q: 'Dans quel film un petit garçon confie-t-il, terrifié : « Je vois des gens qui sont morts » ?', answers: ['sixieme sens', 'le sixieme sens', '6e sens', '6eme sens'], hint: 'Bruce Willis joue un psychologue.' },
  { q: 'Masque blanc, combinaison de mécano : quel tueur s’évade de l’asile pour revenir à Haddonfield le soir d’Halloween ?', answers: ['michael myers', 'myers', 'michael'], hint: 'Il avait tué sa sœur à l’âge de six ans.' },
  { q: 'Dans « Massacre à la tronçonneuse », avec quoi Leatherface fabrique-t-il ses masques ?', answers: ['peau', 'peau humaine', 'de la peau'], hint: 'Son surnom te donne la réponse en anglais.' },
  { q: 'Quelle poupée est enfermée dans une vitrine du musée des Warren, avec un panneau qui interdit formellement de l’ouvrir ?', answers: ['annabelle'], hint: 'Elle a un film à son nom, dérivé de « Conjuring ».' },
  { q: 'Dans une base en Antarctique, une créature venue de l’espace imite parfaitement chacune de ses victimes. Quel film de John Carpenter ?', answers: ['the thing', 'thing', 'la chose', 'the thing 1982'], hint: 'En français, on dirait « la chose ».' },
  { q: '« Je veux jouer à un jeu. » Comment surnomme-t-on le tueur de « Saw », qui piège ses victimes dans des jeux mortels ?', answers: ['jigsaw', 'john kramer', 'kramer'], hint: 'Le mot anglais pour un puzzle.' },
];

// Indices du refuge : du plus énigmatique au plus évident, le cinquième donne la réponse.
export const DEFAULT_CLUES = [
  'Votre refuge a un toit, mais aucun mur.',
  'On y monte quelques marches pour être vu et entendu de tous. L’été, des musiciens y jouent.',
  'Il se dresse sur une place qui porte le nom de l’auteur du « Temps des cerises », poète de la Commune de Paris.',
  'Cherchez la place Jean-Baptiste-Clément.',
  'Le kiosque à musique de la place Jean-Baptiste-Clément.',
];

export const DEFAULT_CFG = {
  evasion: 30, alerte: 30, refuge: 20, every: 5, radius: 1000,
  refugeR: 30, safeR: 50, clueAt: [20, 16, 12, 8, 4], readSecs: 15, mapStyle: 'nuit',
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
