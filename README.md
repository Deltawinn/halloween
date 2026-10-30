# Le dernier portail

Le jeu de la soirée d'Halloween : **l'Évasion** (escape game dans la maison), **l'Alerte générale** (traque GPS dans le quartier) puis **le Refuge** (trouver le point de rassemblement grâce à des indices qui s'autodétruisent).

Site statique, sans serveur ni compte :

- **L'écran TV** (l'ordinateur branché à la télé) fait tourner la partie : il garde l'état, les chronos, les énigmes et les positions.
- **Les téléphones** (joueurs et maître du jeu) lui parlent à travers un relais MQTT public (HiveMQ, EMQX en secours).
- **Tout est chiffré** de bout en bout. La clé de la partie ne circule que dans le fragment `#` des liens d'invitation.
- **Les vrais indices du refuge, le code du cadenas et les lieux** se règlent dans le panneau MJ et restent sur l'écran TV, jamais dans ce dépôt.

## Utilisation

1. Ouvrir le site sur l'ordinateur de la TV, puis **Créer la partie**.
2. Bouton **Panneau MJ** en bas à droite de la TV : scanner le QR avec le téléphone du maître du jeu.
3. Les joueurs scannent le QR affiché sur la TV.

Le **mode démo** (page d'accueil) fait tourner toute la partie sur un seul appareil, avec des monstres virtuels et le temps accéléré.

## Développement

```
npm run relais   # relais MQTT local sur ws://localhost:8883
npm run serve    # http://localhost:8080/?relais=ws://localhost:8883
node dev/tests/nuit.test.mjs   # moteur
node dev/tests/demo.mjs        # parcours démo complet
node dev/tests/reseau.mjs      # TV + MJ + 4 téléphones à travers le relais
```
