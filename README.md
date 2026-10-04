# 🧭 Boussole au trésor

Une boussole façon carte au trésor qui montre la **direction** et la **distance**
de tes lieux favoris à Nantes (maison, travail, commerces…), pour ceux qui n'ont
pas le sens de l'orientation.

C'est une application web installable (PWA) : elle s'ajoute à l'écran d'accueil
du téléphone comme une vraie application et fonctionne hors ligne.

## 📲 Installer l'appli sur ton téléphone

👉 **Lien de l'appli : https://fujee-git.github.io/Boussole-app/**

### Android
1. Ouvre le lien ci-dessus dans **Chrome**. Si tu l'as reçu dans une messagerie,
   choisis **Ouvrir dans Chrome**.
2. Touche les **trois points ⋮** en haut à droite de Chrome, à côté de la barre d'adresse.
3. Choisis **Ajouter à l'écran d'accueil** ou **Installer l'application**, puis confirme.
4. L'icône **Boussole** apparaît parmi tes applications.

### iPhone
1. Ouvre le lien dans **Safari**.
2. Touche le bouton **Partager** (carré avec une flèche vers le haut).
3. Choisis **Sur l'écran d'accueil**, puis **Ajouter**.

### Premier lancement
1. Ouvre l'appli et touche **Lever l'ancre**.
2. **Autorise la localisation**. Elle est indispensable : sans elle, l'appli ne
   sait pas où tu es et ne peut pas afficher tes lieux. Sur iPhone, autorise aussi
   l'accès à l'orientation.
3. L'appli te propose d'enregistrer **ta maison** : touche « Je suis ici » si tu y es,
   ou tape ton adresse. Tu peux aussi faire « Plus tard ».
4. Ajoute tes autres lieux avec le bouton **📜** puis **＋**.

Chacun a ses propres lieux, enregistrés uniquement sur son téléphone : personne
d'autre ne les voit.

**La boussole semble fausse ?** 📜 → « Calibrer » : téléphone en main, en l'air
devant toi, dessine 3 ou 4 grands 8 couchés (∞) avec le bras en faisant pivoter le
poignet dans tous les sens, loin des objets métalliques. Pas besoin de toucher l'écran.

## Fonctionnalités

- **Sceaux de cire** autour de la rose des vents, placés dans la vraie direction
  de chaque lieu. Plus un lieu est proche, plus son sceau est gros et proche du centre.
- **Phrase d'aide** : « La Cathédrale est un peu sur ta droite, à 910 m ».
- **Mode « Guide-moi »** : touche un sceau, une aiguille rouge pointe vers le lieu
  et le téléphone **vibre** quand tu es bien aligné. L'écran reste allumé.
- **Mes lieux** (📜) : ajoute un lieu en enregistrant ta position actuelle ou en
  cherchant une adresse ; choisis son emblème et sa couleur ; masque ou supprime
  les repères de Nantes fournis.

## Confidentialité

- **Aucune adresse personnelle n'est dans ce dépôt.** Tes lieux sont enregistrés
  uniquement dans le stockage local du navigateur, sur ton téléphone.
- La recherche d'adresse interroge [Nominatim (OpenStreetMap)](https://nominatim.org/) :
  le texte tapé est envoyé à leur serveur. Pour rester 100 % privé, utilise plutôt
  « Je suis ici, enregistrer ma position » une fois sur place.
- Attention : effacer les données de Chrome pour ce site efface aussi tes lieux.

## Mise en ligne (pour le propriétaire du dépôt)

1. Sur GitHub : **Settings → Pages**.
2. *Source* : **Deploy from a branch**, choisis la branche (par ex. `main` une fois
   fusionnée) et le dossier **/ (root)**, puis **Save**.
3. Après une minute, l'appli est disponible sur
   https://fujee-git.github.io/Boussole-app/ (déjà fait).

## Développement

Aucun outil de build : HTML, CSS et JavaScript purs.

```sh
npx http-server -p 8080   # puis http://localhost:8080
```

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure des écrans (boussole, lieux, formulaire) |
| `style.css` | Thème parchemin / carte au trésor |
| `app.js` | Capteurs, calculs de cap et de distance, rendu, réglages |
| `sw.js` | Service worker (hors ligne). **Incrémenter `VERSION` à chaque mise à jour.** |
| `manifest.webmanifest` | Nom, icônes, mode plein écran |

Les coordonnées des repères de Nantes (`PRESETS` dans `app.js`) sont approximatives.
