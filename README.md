# 🧭 Boussole au trésor

Une boussole façon carte au trésor qui montre la **direction** et la **distance**
de tes lieux favoris à Nantes (maison, travail, commerces…), pour ceux qui n'ont
pas le sens de l'orientation.

C'est une application web installable (PWA) : elle s'ajoute à l'écran d'accueil
du téléphone comme une vraie application et fonctionne hors ligne.

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

## Mise en ligne (GitHub Pages)

1. Sur GitHub : **Settings → Pages**.
2. *Source* : **Deploy from a branch**, choisis la branche (par ex. `main` une fois
   fusionnée) et le dossier **/ (root)**, puis **Save**.
3. Après une minute, l'appli est disponible sur
   `https://<ton-compte>.github.io/Boussole-app/`.

## Installation sur Android

1. Ouvre l'adresse GitHub Pages dans **Chrome**.
2. Menu ⋮ → **Ajouter à l'écran d'accueil** (ou **Installer l'application**).
3. Lance « Boussole » depuis tes applications, touche **Lever l'ancre** et
   autorise la localisation.

Au premier lancement, l'appli propose d'enregistrer ta **maison** (une seule fois ;
« Plus tard » pour passer). Elle est mémorisée sur le téléphone d'une session à l'autre.

**Calibrer la boussole** (📜 → « Calibrer ») : téléphone en main, en l'air devant toi,
dessine 3 ou 4 grands 8 couchés (∞) avec le bras en faisant pivoter le poignet dans
tous les sens, loin des objets métalliques. Pas besoin de toucher l'écran.

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
