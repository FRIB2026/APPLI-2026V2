export interface TransportLine {
  id: string;
  label: string;
  amount: number;
}

export interface PaveTarifItem {
  id: string;
  name: string;
  finition: 'eclate' | 'rectifie' | 'autre';
  prixTonne: number;
  m2Tonne: number;
}

export interface TransportTarifConfig {
  prixCamionComplet24t: number; // 2050 € HT par camion de 24t (24 Big Bags)
  capaciteCamionBags: number;   // 24 Big Bags (24 tonnes)
  prixGroupageTonne: number;    // 150 € HT / tonne (par Big Bag de 1000 kg)
}

export interface SavedQuote {
  id: string;
  title: string;
  clientRef: string;
  createdAt: string;
  createdAtMs?: number;
  paveId1?: string;
  paveName1?: string;
  qte1: number;
  prixTonne1: number;
  paveId2?: string;
  paveName2?: string;
  qte2: number;
  prixTonne2: number;
  m2Tonne: number;
  coef: number;
  prixCamionComplet24t: number;
  prixGroupageTonne: number;
  transportMode?: 'auto' | 'camion' | 'groupage' | 'strict24' | 'manuel';
  nbCamionsManuel?: number;
  nbGroupageBagsManuel?: number;
  extraTransportLines?: TransportLine[];
}

export const COEFS = [1.20, 1.25, 1.30, 1.35, 1.40, 1.45, 1.50];

export const DEFAULT_TRANSPORT_TARIFS: TransportTarifConfig = {
  prixCamionComplet24t: 2050,
  capaciteCamionBags: 24,
  prixGroupageTonne: 150,
};

export const DEFAULT_PAVE_DATABASE: PaveTarifItem[] = [
  {
    id: 'gris-10x10x5-eclate',
    name: 'Pavé granit GRIS 10X10X5 éclaté',
    finition: 'eclate',
    prixTonne: 62.50,
    m2Tonne: 9.5,
  },
  {
    id: 'jaune-10x10x5-eclate',
    name: 'Pavé granit JAUNE 10X10X5 éclaté',
    finition: 'eclate',
    prixTonne: 82.50,
    m2Tonne: 9.5,
  },
  {
    id: 'rose-10x10x5-eclate',
    name: 'Pavé granit ROSE 10X10X5 éclaté',
    finition: 'eclate',
    prixTonne: 105.00,
    m2Tonne: 9.5,
  },
  {
    id: 'noir-10x10x5-eclate',
    name: 'Pavé granit NOIR 10X10X5 éclaté',
    finition: 'eclate',
    prixTonne: 145.00,
    m2Tonne: 9.5,
  },
  {
    id: 'gris-10x10x5-rectifie',
    name: 'Pavé granit GRIS 10X10X5 rectifié',
    finition: 'rectifie',
    prixTonne: 255.00,
    m2Tonne: 10.0,
  },
  {
    id: 'jaune-10x10x5-rectifie',
    name: 'Pavé granit JAUNE 10X10X5 rectifié',
    finition: 'rectifie',
    prixTonne: 270.00,
    m2Tonne: 10.0,
  },
  {
    id: 'rose-10x10x5-rectifie',
    name: 'Pavé granit ROSE 10X10X5 rectifié',
    finition: 'rectifie',
    prixTonne: 270.00,
    m2Tonne: 10.0,
  },
  {
    id: 'noir-10x10x5-rectifie',
    name: 'Pavé granit NOIR 10X10X5 rectifié',
    finition: 'rectifie',
    prixTonne: 320.00,
    m2Tonne: 10.0,
  },
];

export const INITIAL_SAVED_QUOTES: SavedQuote[] = [
  {
    id: 'quote-default-decor-77550',
    title: 'Granit Gris 218,5 m² + Jaune 9,5 m² (24 Big Bags)',
    clientRef: 'Livraison dépôt 77550',
    createdAt: '27/09/2026',
    createdAtMs: 1790496000000,
    paveId1: 'gris-10x10x5-eclate',
    paveName1: 'Pavé granit GRIS 10X10X5 éclaté',
    qte1: 218.5,
    prixTonne1: 62.50,
    paveId2: 'jaune-10x10x5-eclate',
    paveName2: 'Pavé granit JAUNE 10X10X5 éclaté',
    qte2: 9.5,
    prixTonne2: 82.50,
    m2Tonne: 9.5,
    coef: 1.50,
    prixCamionComplet24t: 2050,
    prixGroupageTonne: 150,
    extraTransportLines: [],
  },
  {
    id: 'quote-exemple-351-5m2',
    title: 'Exemple 351,5 m² — 37 Big Bags (24t + 13t Groupage)',
    clientRef: 'Livraison dépôt 77550',
    createdAt: '27/09/2026',
    createdAtMs: 1790495000000,
    paveId1: 'gris-10x10x5-eclate',
    paveName1: 'Pavé granit GRIS 10X10X5 éclaté',
    qte1: 351.5,
    prixTonne1: 62.50,
    paveId2: 'jaune-10x10x5-eclate',
    paveName2: 'Pavé granit JAUNE 10X10X5 éclaté',
    qte2: 0,
    prixTonne2: 82.50,
    m2Tonne: 9.5,
    coef: 1.50,
    prixCamionComplet24t: 2050,
    prixGroupageTonne: 150,
    extraTransportLines: [],
  },
];
