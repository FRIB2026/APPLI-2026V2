# Calculateur Pavé + Transport & Studio Maquettes Logo

Une application web complète réunissant fidèlement votre **Calculateur Pavé + Transport (HT)** (avec son esthétique minérale exacte, un catalogue de pierres pré-configurées, l'historique de devis et l'impression professionnelle) ainsi qu'un **Studio de Maquettes de Produits (Mugs, T-Shirts, Textiles)** combinant placement interactif sur toile et génération photoréaliste par IA.

### Revue Utilisateur & Décisions Clés

> [!IMPORTANT]
> Comme les réponses aux questions de clarification ont retenu à la fois les améliorations du **Calculateur Pavé + Transport** et les fonctionnalités du **Studio de Maquettes de Logo**, le plan intègre les deux espaces au sein d'une interface unifiée avec un sélecteur de mode discret en haut de page (automatiquement masqué à l'impression pour garantir un devis pavé 100 % conforme à votre modèle).

- **Décision confirmée 1 (Design & Formules du Calculateur)** : Conservation stricte de la palette minérale (`#F0ECE4` clair / `#1C1A17` sombre, accents sauge `#4F6B52` et terre cuite `#B85C38`), des polices (`Archivo`, `IBM Plex Mono`, `Inter`) et des formules exactes de coût granit, transport multi-lignes et comparatif de coefficients (`1,20×` à `1,50×`).
- **Décision confirmée 2 (Catalogue, Devis & Thème)** : Ajout de puces de sélection rapide pour un catalogue de pavés (Granit gris/jaune/rose, Porphyre, Grès, Pavé de récupération), sauvegarde locale des devis avec nom de chantier/client, bascule manuelle thème clair/sombre et mise en page d'impression optimisée.
- **Décision confirmée 3 (Studio Maquettes Logo)** : Intégration d'un atelier permettant d'importer un logo (PNG/SVG/JPG), de le positionner/redimensionner/fusionner en temps réel sur des produits (Mug céramique, T-Shirt, Tote Bag, Sweat, Tenue pro) et de générer des mises en situation photoréalistes par IA.

---

### 1. Vue d'Ensemble & Concept

- **Ce que fait l'application** :
  1. **Volet Calculateur Pavé + Transport (Vue principale)** : Permet de chiffrer instantanément en HT le prix de vente au m², le total HT et la marge nette d'une commande de pavés en fonction du tonnage, du rendement au m²/t et d'un nombre illimité de lignes de transport (camion complet, groupage, grue, etc.).
  2. **Volet Studio Maquettes Logo** : Permet de téléverser un logo d'entreprise, de l'ajuster de façon interactive sur différents supports (mugs, t-shirts, accessoires) avec fusion réaliste des textures, ou de générer un rendu studio photoréaliste via l'IA.
- **Public cible** : Négoce de matériaux, paysagistes, travaux publics (dépôt 77550) et créateurs souhaitant chiffrer rapidement leurs commandes et visualiser leurs supports de marque.
- **Valeur ajoutée** : Chiffrage sans erreur sur mobile comme sur ordinateur, mémorisation des devis récurrents, fiches imprimables propres pour les clients et création rapide de visuels produits personnalisés.

---

### 2. Expérience Utilisateur & Design Visuel

- **Parcours Utilisateur Clés** :
  1. **Chiffrage rapide & Catalogue Pavés** : L'utilisateur saisit la quantité en m² ou clique sur un matériau du catalogue pré-configuré (ex. *Granit Gris 10×10 — 62,50 €/t · 9,5 m²/t*, *Porphyre — 85,00 €/t · 8,5 m²/t*, *Grès Inde — 74,00 €/t · 9,0 m²/t*), ce qui met à jour instantanément la carte héro (« Prix de vente HT au m² », « Total HT », « Marge totale HT »).
  2. **Gestion du Transport & des Coefficients** : Ajout, modification ou suppression de lignes de transport à la volée ; sélection rapide du coefficient multiplicateur via les puces (`1,20×` à `1,50×`) ou saisie libre, avec mise en évidence de la ligne active dans le tableau comparatif.
  3. **Sauvegarde, Historique & Impression** : Enregistrement d'un devis nommé (ex. *Chantier Melun — 228 m²*) dans le stockage local, rechargement en un clic, bascule thème clair/sombre et impression/export PDF épuré (sans les boutons d'édition).
  4. **Création de Maquettes de Logo** : Bascule vers l'onglet *Studio Maquettes*, import d'un logo par glisser-déposer (ou choix d'un logo de démonstration), sélection du produit (Mug, T-Shirt, Tote Bag, Casquette) et de sa couleur, ajustement direct à la souris/doigt sur la toile (taille, rotation, opacité, courbure/fusion `multiply`), téléchargement PNG haute résolution ou génération d'une photo studio par IA.

- **Identité Visuelle & Thème** :
  - *Direction esthétique* : Utilitarisme minéral, chaleureux et haute lisibilité, fidèle au design fourni.
  - *Palette de couleurs* :
    - Mode Clair (`data-theme="light"`) : Fond pierre calcaire `--bg: #F0ECE4`, surfaces `--surface: #FFFFFF`, encre `--ink: #22201C`, pierre `--stone: #8C8478`, sauge `--accent: #4F6B52`, terre cuite `--clay: #B85C38`, bordures `--line: #DEDACF`.
    - Mode Sombre (`data-theme="dark"`) : Fond basalte `--bg: #1C1A17`, surfaces `--surface: #26231F`, encre `--ink: #F0ECE4`, pierre `--stone: #A79E8F`, sauge `--accent: #8FB894`, terre cuite `--clay: #E08A62`, bordures `--line: #3A362F`.
  - *Typographie & Hiérarchie* :
    - Titres et structure : `Archivo` (600, 700) avec approche serrée (`-0.01em`).
    - Données chiffrées, prix et coefficients : `IBM Plex Mono` (400, 500, 600) avec alignement tabulaire (`tabular-nums`) et formatage français (`228`, `62,50 €`).
    - Libellés et interface : `Inter` (400, 500).
  - *Mise en page & Ergonomie* : Conteneur centré ultra-lisible pour le calculateur (optimisé mobile et bureau avec cibles tactiles $\ge 44\text{px}$), et espace de travail côte-à-côte sur grand écran pour le Studio Maquettes.

- **Interactions & Retours Visuels** :
  - Recalcul instantané à chaque frappe sans latence.
  - Feuille de style `@media print` dédiée qui masque les contrôles d'édition, les puces et la barre de navigation pour produire une fiche de chiffrage HT prête à remettre ou archiver en PDF.

---

### 3. Décisions Produit & Arbitrages Techniques

- **Décision 1 : Architecture bi-mode non intrusive**
  - *Approche choisie* : Le Calculateur Pavé + Transport s'affiche directement au chargement avec un respect au pixel près de votre structure HTML/CSS, enrichi d'une barre supérieure discrète permettant d'ouvrir le catalogue, l'historique des devis, le thème clair/sombre et le Studio Maquettes Logo.
  - *Pourquoi* : Vous profitez immédiatement de votre outil métier sans friction tout en disposant du studio de maquettes demandé dans le même espace de travail.
  - *Alternative écartée* : Séparer l'écran en deux colonnes permanentes sur mobile, ce qui aurait réduit la lisibilité du calculateur sur smartphone.

- **Décision 2 : Double moteur de maquettes (Toile Canvas temps réel + IA générative)**
  - *Approche choisie* : Un moteur local sur toile HTML5 (`<canvas>`) pour manipuler le logo à 60 fps (déplacement, échelle, rotation, mode de fusion réaliste sur le tissu ou la céramique) couplé à une route serveur IA (`gemini-3.1-flash-lite-image`) pour générer des mises en scène photographiques.
  - *Pourquoi* : Le placement sur toile offre un contrôle géométrique immédiat et gratuit, tandis que l'IA produit des rendus publicitaires photoréalistes avec éclairage studio.

---

### 4. Architecture Technique & Modèle de Données

- **Diagramme d'Architecture & Composants** :

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      En-tête & Barre d'Outils                           │
│  [Sélecteur : Calculateur Pavé | Studio Logo]  [Thème ☀️/🌙]  [🖨️ PDF]  │
└───────────────────┬─────────────────────────────────────┬───────────────┘
                    │                                     │
                    ▼                                     ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│     MODULE 1 : CALCULATEUR PAVÉ       │ │  MODULE 2 : STUDIO MAQUETTES  │
│                                       │ │                               │
│  ┌─────────────────────────────────┐  │ │  ┌─────────────────────────┐  │
│  │ Carte Héro : €/m², Total, Marge │  │ │  │ Import Logo & Réglages  │  │
│  └─────────────────────────────────┘  │ │  │ (Taille, Rotation, Fond)│  │
│  ┌─────────────────────────────────┐  │ │  └───────────┬─────────────┘  │
│  │ Catalogue Pavés & Saisie Produit│  │ │              ▼                │
│  │ (Qté m², Prix €/t, Surface m²/t)│  │ │  ┌─────────────────────────┐  │
│  └─────────────────────────────────┘  │ │  │ Toile Interactive 2D    │  │
│  ┌─────────────────────────────────┐  │ │  │ (Mug, T-Shirt, Tote...) │  │
│  │ Lignes de Transport Dynamiques  │  │ │  └───────────┬─────────────┘  │
│  └─────────────────────────────────┘  │ │              ▼                │
│  ┌─────────────────────────────────┐  │ │  ┌─────────────────────────┐  │
│  │ Marge, Détail & Comparatif Coef │  │ │  │ Rendu IA Photoréaliste  │  │
│  └─────────────────────────────────┘  │ │  └───────────┬─────────────┘  │
│  ┌─────────────────────────────────┐  │ └──────────────┼────────────────┘
│  │ Devis Types & Historique Local  │  │                │
│  └─────────────────────────────────┘  │                ▼
└───────────────────┬───────────────────┘ ┌───────────────────────────────┐
                    │                     │ Serveur Express (/api/mockup) │
                    ▼                     │ SDK @google/genai (Serveur)   │
        [Stockage Local Navigateur]       └───────────────────────────────┘
```

- **Modèle de Données & État** :
  - `PavePreset` : `{ id, name, category, prixTonne, m2Tonne, description }` (catalogue de pavés pré-configurés).
  - `TransportLine` : `{ id, label, amount }` (lignes de transport dynamiques avec « Camion complet : 2050 € » et « Groupage : 0 € » par défaut).
  - `SavedQuote` : `{ id, title, date, qte, prixTonne, m2Tonne, coef, tlines, venteM2, venteTotal, margeTotal }` (persisté dans `localStorage`).
  - `MockupState` : `{ productType, productColor, logoDataUrl, x, y, scale, rotation, opacity, blendMode, aiScenePrompt, generatedAiImage }`.

- **Correspondance des Interactions & Gestionnaires d'État** :
  - *Calculateur & Catalogue* : Toute modification de `qte`, `prixTonne`, `m2Tonne`, `coef` ou `tlines` déclenche instantanément le recalcul des indicateurs HT et met à jour la ligne surlignée (`current`) du tableau comparatif. Cliquer sur un pavé du catalogue remplit automatiquement `prixTonne` et `m2Tonne`.
  - *Gestionnaire de Devis* : Permet d'enregistrer la configuration actuelle avec un nom de chantier, de dupliquer ou supprimer un devis sauvegardé, et d'ajouter un en-tête de chantier optionnel visible à l'impression.
  - *Toile Interactive & Génération IA* : Glisser-déposer directement sur le produit pour déplacer le logo, curseurs précis pour la taille/rotation/courbure, export direct de la toile en PNG (`canvas.toDataURL`), et appel serveur `POST /api/generate-mockup` combinant l'image du logo en base64 et la description du produit pour générer une photo réaliste via `gemini-3.1-flash-lite-image`.
