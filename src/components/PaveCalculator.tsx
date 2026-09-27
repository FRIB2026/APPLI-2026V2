import React, { useState, useEffect } from 'react';
import {
  COEFS,
  DEFAULT_PAVE_DATABASE,
  DEFAULT_TRANSPORT_TARIFS,
  INITIAL_SAVED_QUOTES,
  PaveTarifItem,
  TransportTarifConfig,
  TransportLine,
  SavedQuote,
} from '../data/presets';
import {
  Share2,
  Bookmark,
  Printer,
  Check,
  RotateCcw,
  Trash2,
  X,
  Database,
  Plus,
  PackageCheck,
  Truck,
  Copy,
  Cloud,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const STORAGE_KEY_QUOTES = 'pave_transport_saved_quotes_v5';
const STORAGE_KEY_PAVE_DB = 'pave_transport_tarif_db_v2';
const STORAGE_KEY_TRANSPORT_DB = 'pave_transport_tarif_config_v2';
const STORAGE_KEY_PAVE_DB_DATE = 'pave_transport_tarif_db_date_v2';

export const fmt = (n: number): string =>
  Number.isFinite(n)
    ? n.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '–';

export const fmtCompact = (n: number): string => {
  if (!Number.isFinite(n)) return '–';
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('fr-FR')
    : rounded.toLocaleString('fr-FR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      });
};

export const PaveCalculator: React.FC = () => {
  // Base de données des prix des pavés à la tonne (éditable mensuellement / annuellement)
  const [paveDb, setPaveDb] = useState<PaveTarifItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PAVE_DB);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PAVE_DATABASE;
  });

  // Base de données des tarifs Transport (Camion complet 24t = 2050 €, Groupage = 150 €/t)
  const [transportDb, setTransportDb] = useState<TransportTarifConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TRANSPORT_DB);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.prixCamionComplet24t === 'number') {
          return {
            prixCamionComplet24t: parsed.prixCamionComplet24t ?? 2050,
            capaciteCamionBags: parsed.capaciteCamionBags ?? 24,
            prixGroupageTonne: parsed.prixGroupageTonne ?? 150,
          };
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_TRANSPORT_TARIFS;
  });

  const [dbLastUpdated, setDbLastUpdated] = useState<string>(() => {
    try {
      return (
        localStorage.getItem(STORAGE_KEY_PAVE_DB_DATE) ||
        new Date().toLocaleDateString('fr-FR')
      );
    } catch {
      return new Date().toLocaleDateString('fr-FR');
    }
  });

  // Line 1: Pavé principal (initialisé à 0 m² à chaque démarrage)
  const [selectedPaveId1, setSelectedPaveId1] = useState<string>(
    'gris-10x10x5-eclate'
  );
  const [qte1, setQte1] = useState<string>('0');
  const [prixTonne1, setPrixTonne1] = useState<string>('62.50');

  // Line 2: Pavé décor / 2e choix (initialisé à 0 m² à chaque démarrage)
  const [selectedPaveId2, setSelectedPaveId2] = useState<string>(
    'jaune-10x10x5-eclate'
  );
  const [qte2, setQte2] = useState<string>('0');
  const [prixTonne2, setPrixTonne2] = useState<string>('82.50');

  // Surface couverte par Big Bag de 1000 kg (1 tonne) : 9,5 m² (éclaté) ou 10 m² (rectifié)
  const [m2Tonne, setM2Tonne] = useState<string>('9.5');
  const [coef, setCoef] = useState<string>('1.50');

  // Valeurs de transport actives (2050 € et 150 €/t en référence, modifiables à tout moment)
  const [prixCamionStr, setPrixCamionStr] = useState<string>(() =>
    String(transportDb.prixCamionComplet24t)
  );
  const [prixGroupageTonneStr, setPrixGroupageTonneStr] = useState<string>(() =>
    String(transportDb.prixGroupageTonne)
  );
  const [transportMode, setTransportMode] = useState<
    'auto' | 'camion' | 'groupage' | 'strict24' | 'manuel'
  >('auto');
  const [manualCamionsStr, setManualCamionsStr] = useState<string>('1');
  const [manualGroupageBagsStr, setManualGroupageBagsStr] =
    useState<string>('0');
  const initialTarifsSyncedRef = React.useRef<boolean>(false);

  // Lignes de transport complémentaires éventuelles (ex: grue, manutention...)
  const [extraTlines, setExtraTlines] = useState<TransportLine[]>([]);

  const [clientRef, setClientRef] = useState<string>('livraison dépôt 77550');
  const [showShareSheet, setShowShareSheet] = useState<boolean>(false);
  const [showQuotesSheet, setShowQuotesSheet] = useState<boolean>(false);
  const [showDbSheet, setShowDbSheet] = useState<boolean>(false);
  const [quoteTitle, setQuoteTitle] = useState<string>('');
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<boolean>(false);
  const [showStickyMiniHero, setShowStickyMiniHero] = useState<boolean>(false);

  // Formulaire d'ajout d'un nouveau pavé dans la base de données
  const [newPaveName, setNewPaveName] = useState<string>('');
  const [newPaveFinition, setNewPaveFinition] = useState<
    'eclate' | 'rectifie' | 'autre'
  >('eclate');
  const [newPavePrix, setNewPavePrix] = useState<string>('');
  const [newPaveM2, setNewPaveM2] = useState<string>('9.5');

  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_QUOTES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_SAVED_QUOTES;
  });
  const [cloudConnected, setCloudConnected] = useState<boolean>(false);

  // Synchronisation Cloud Firestore : Collection /quotes et Document /settings/tarifs
  useEffect(() => {
    const quotesQuery = query(
      collection(db, 'quotes'),
      where('createdAtMs', '>=', 0)
    );

    const unsubQuotes = onSnapshot(
      quotesQuery,
      (snapshot) => {
        setCloudConnected(true);
        if (snapshot.empty) {
          const alreadySeeded = localStorage.getItem('pave_cloud_seeded_v1');
          if (!alreadySeeded) {
            localStorage.setItem('pave_cloud_seeded_v1', 'true');
            INITIAL_SAVED_QUOTES.forEach((initQ) => {
              const payload: SavedQuote = {
                ...initQ,
                createdAtMs: initQ.createdAtMs ?? Date.now(),
                paveId1: initQ.paveId1 || 'gris-10x10x5-eclate',
                paveName1: initQ.paveName1 || 'Pavé granit GRIS 10X10X5 éclaté',
                paveId2: initQ.paveId2 || 'jaune-10x10x5-eclate',
                paveName2: initQ.paveName2 || 'Pavé granit JAUNE 10X10X5 éclaté',
                extraTransportLines: initQ.extraTransportLines || [],
              };
              setDoc(doc(db, 'quotes', payload.id), payload).catch((err) => {
                handleFirestoreError(
                  err,
                  OperationType.WRITE,
                  `quotes/${payload.id}`
                );
              });
            });
          } else {
            setSavedQuotes([]);
          }
          return;
        }

        const cloudList: SavedQuote[] = [];
        snapshot.forEach((docSnap) => {
          cloudList.push(docSnap.data() as SavedQuote);
        });
        cloudList.sort(
          (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)
        );
        setSavedQuotes(cloudList);
        try {
          localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(cloudList));
        } catch {
          // ignore
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'quotes');
      }
    );

    const tarifsDocRef = doc(db, 'settings', 'tarifs');
    const unsubTarifs = onSnapshot(
      tarifsDocRef,
      (docSnap) => {
        setCloudConnected(true);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data.paveList) && data.paveList.length > 0) {
            setPaveDb(data.paveList);
          }
          if (typeof data.prixCamionComplet24t === 'number') {
            const nextTrans: TransportTarifConfig = {
              prixCamionComplet24t: data.prixCamionComplet24t,
              capaciteCamionBags: data.capaciteCamionBags ?? 24,
              prixGroupageTonne: data.prixGroupageTonne ?? 150,
            };
            setTransportDb(nextTrans);
            if (!initialTarifsSyncedRef.current) {
              initialTarifsSyncedRef.current = true;
              setPrixCamionStr(String(nextTrans.prixCamionComplet24t));
              setPrixGroupageTonneStr(String(nextTrans.prixGroupageTonne));
            }
          }
          if (typeof data.updatedAt === 'string') {
            setDbLastUpdated(data.updatedAt);
          }
        } else {
          // Initialisation du document /settings/tarifs dans Firestore
          const initialTarifsPayload = {
            updatedAt: new Date().toLocaleDateString('fr-FR'),
            prixCamionComplet24t: DEFAULT_TRANSPORT_TARIFS.prixCamionComplet24t,
            capaciteCamionBags: DEFAULT_TRANSPORT_TARIFS.capaciteCamionBags,
            prixGroupageTonne: DEFAULT_TRANSPORT_TARIFS.prixGroupageTonne,
            paveList: DEFAULT_PAVE_DATABASE,
          };
          setDoc(tarifsDocRef, initialTarifsPayload).catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, 'settings/tarifs');
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/tarifs');
      }
    );

    return () => {
      unsubQuotes();
      unsubTarifs();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(savedQuotes));
    } catch {
      // ignore
    }
  }, [savedQuotes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PAVE_DB, JSON.stringify(paveDb));
      localStorage.setItem(STORAGE_KEY_TRANSPORT_DB, JSON.stringify(transportDb));
      localStorage.setItem(STORAGE_KEY_PAVE_DB_DATE, dbLastUpdated);
    } catch {
      // ignore
    }
  }, [paveDb, transportDb, dbLastUpdated]);

  // Sauvegarde Cloud des tarifs dans Firestore (/settings/tarifs)
  const syncTarifsToFirestore = (
    nextPaveList: PaveTarifItem[],
    nextTransport: TransportTarifConfig
  ) => {
    const nowDate = new Date().toLocaleDateString('fr-FR').slice(0, 40);
    setDbLastUpdated(nowDate);
    const payload = {
      updatedAt: nowDate,
      prixCamionComplet24t: Math.min(
        100000,
        Math.max(0, Number(nextTransport.prixCamionComplet24t) || 0)
      ),
      capaciteCamionBags: Math.min(
        100,
        Math.max(1, Number(nextTransport.capaciteCamionBags) || 24)
      ),
      prixGroupageTonne: Math.min(
        100000,
        Math.max(0, Number(nextTransport.prixGroupageTonne) || 0)
      ),
      paveList: nextPaveList.slice(0, 60),
    };
    setDoc(doc(db, 'settings', 'tarifs'), payload).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, 'settings/tarifs');
    });
  };

  // Show compact sticky bar on mobile when scrolling past the main hero card
  useEffect(() => {
    const onScroll = () => {
      setShowStickyMiniHero(window.scrollY > 170);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Calculs mathématiques HT avec les 2 lignes de quantité + prix
  const numQte1 = parseFloat(qte1) || 0;
  const numPrixTonne1 = parseFloat(prixTonne1) || 0;
  const numQte2 = parseFloat(qte2) || 0;
  const numPrixTonne2 = parseFloat(prixTonne2) || 0;
  const numM2t = parseFloat(m2Tonne) || 0;
  const numCoef = parseFloat(coef) || 0;

  const numQteTotal = numQte1 + numQte2;

  const prixGranit1M2 = numM2t ? numPrixTonne1 / numM2t : 0;
  const prixGranit2M2 = numM2t ? numPrixTonne2 / numM2t : 0;

  const coutGranit1 = prixGranit1M2 * numQte1;
  const coutGranit2 = prixGranit2M2 * numQte2;
  const coutGranit = coutGranit1 + coutGranit2;

  // Calcul Big Bags de 1000 kg (1 Big Bag = 1000 kg = 1 tonne)
  const bigBagsExact1 = numM2t > 0 ? numQte1 / numM2t : 0;
  const bigBagsExact2 = numM2t > 0 ? numQte2 / numM2t : 0;
  const bigBagsExactTotal = bigBagsExact1 + bigBagsExact2;

  // Nombre de Big Bags entiers (conditionnés à 1000 kg) à transporter
  // Ex: 350 m² / 9,5 = 36,84 Big Bags -> 37 Big Bags entiers (37 tonnes) à charger
  const wholeBags1 =
    numQte1 > 0 && numM2t > 0 ? Math.ceil(bigBagsExact1 - 0.0001) : 0;
  const wholeBags2 =
    numQte2 > 0 && numM2t > 0 ? Math.ceil(bigBagsExact2 - 0.0001) : 0;
  const totalWholeBagsToShip = wholeBags1 + wholeBags2;

  // Calcul Transport intelligent & flexible :
  // - Référence Camion complet (24t max) = 2 050 € HT (modifiable à tout moment)
  // - Référence Groupage = 150 € HT / tonne (modifiable à tout moment)
  // - Même si < 24 Big Bags (ex: 200 m² = 22 BB), un camion complet (2 050 €) est plus intéressant
  //   que 22 BB × 150 € = 3 300 € !
  const capaciteCamion = Math.max(1, transportDb.capaciteCamionBags || 24);
  const numPrixCamionComplet = parseFloat(prixCamionStr) || 0;
  const numPrixGroupageTonne = parseFloat(prixGroupageTonneStr) || 0;

  // Décomposition stricte par tranches de 24 Big Bags
  const strictFullTrucks = Math.floor(totalWholeBagsToShip / capaciteCamion);
  const strictRemainderBags =
    totalWholeBagsToShip - strictFullTrucks * capaciteCamion;

  // Décomposition "Auto (Le + intéressant)" :
  // Si le coût du reliquat en groupage (ex: 22 BB × 150 € = 3 300 €) dépasse le prix d'un camion complet (2 050 €),
  // on bascule automatiquement ce reliquat sur 1 camion complet (et 0 BB en groupage).
  const isFullTruckCheaperForRemainder =
    strictRemainderBags > 0 &&
    numPrixCamionComplet > 0 &&
    strictRemainderBags * numPrixGroupageTonne > numPrixCamionComplet;

  const autoCamions =
    totalWholeBagsToShip === 0
      ? 0
      : isFullTruckCheaperForRemainder
      ? strictFullTrucks + 1
      : strictFullTrucks;
  const autoGroupageBags =
    totalWholeBagsToShip === 0
      ? 0
      : isFullTruckCheaperForRemainder
      ? 0
      : strictRemainderBags;

  // Nombre de camions complets si on choisit "Camion complet uniquement" (même pour < 24 BB, ex: 200 m²)
  const forcedFullTrucksCount =
    totalWholeBagsToShip > 0
      ? Math.max(1, Math.ceil(totalWholeBagsToShip / capaciteCamion))
      : 1;

  let nbCamionsComplets = 0;
  let deltaBagsGroupage = 0;

  if (transportMode === 'auto') {
    nbCamionsComplets = autoCamions;
    deltaBagsGroupage = autoGroupageBags;
  } else if (transportMode === 'camion') {
    nbCamionsComplets = forcedFullTrucksCount;
    deltaBagsGroupage = 0;
  } else if (transportMode === 'groupage') {
    nbCamionsComplets = 0;
    deltaBagsGroupage = totalWholeBagsToShip;
  } else if (transportMode === 'strict24') {
    nbCamionsComplets = strictFullTrucks;
    deltaBagsGroupage = strictRemainderBags;
  } else {
    // Mode 'manuel'
    nbCamionsComplets = Math.max(0, parseFloat(manualCamionsStr) || 0);
    deltaBagsGroupage = Math.max(0, parseFloat(manualGroupageBagsStr) || 0);
  }

  const bagsInFullTrucks = Math.min(
    totalWholeBagsToShip,
    nbCamionsComplets * capaciteCamion
  );

  // Coûts comparatifs pour affichage d'aide à la décision
  const coutOptionCamionComplet = forcedFullTrucksCount * numPrixCamionComplet;
  const coutOptionToutGroupage = totalWholeBagsToShip * numPrixGroupageTonne;

  const coutCamionsComplets = nbCamionsComplets * numPrixCamionComplet;
  const coutGroupageDelta = deltaBagsGroupage * numPrixGroupageTonne;
  const coutExtraTransport = extraTlines.reduce(
    (s, l) => s + (Number(l.amount) || 0),
    0
  );

  const coutTransport =
    coutCamionsComplets + coutGroupageDelta + coutExtraTransport;
  const coutTransportM2 = numQteTotal ? coutTransport / numQteTotal : 0;

  const coutRevientTotal = coutGranit + coutTransport;
  const coutRevientM2 = numQteTotal ? coutRevientTotal / numQteTotal : 0;

  const venteTotal = coutRevientTotal * numCoef;
  const venteM2 = numQteTotal ? venteTotal / numQteTotal : 0;
  const margeTotal = venteTotal - coutRevientTotal;

  // Prix de vente HT au m² détaillé par ligne (incluant quote-part transport + marge)
  const venteM2Ligne1 = (prixGranit1M2 + coutTransportM2) * numCoef;
  const venteM2Ligne2 = (prixGranit2M2 + coutTransportM2) * numCoef;

  // Prix TTC pour les particuliers (TVA 20 %)
  const TVA_MULTIPLIER = 1.2;
  const venteM2TTC = venteM2 * TVA_MULTIPLIER;
  const venteTotalTTC = venteTotal * TVA_MULTIPLIER;
  const venteM2Ligne1TTC = venteM2Ligne1 * TVA_MULTIPLIER;
  const venteM2Ligne2TTC = venteM2Ligne2 * TVA_MULTIPLIER;

  // Calcul d'arrondi Big Bags entiers (1000 kg) pour Pavé 1
  const isExactBigBag1 =
    numQte1 > 0 && Math.abs(bigBagsExact1 - Math.round(bigBagsExact1)) < 0.001;
  const floorBags1 = Math.max(1, Math.floor(bigBagsExact1));
  const ceilBags1 = Math.ceil(bigBagsExact1);
  const floorM2_1 = Math.round(floorBags1 * numM2t * 100) / 100;
  const ceilM2_1 = Math.round(ceilBags1 * numM2t * 100) / 100;

  // Calcul d'arrondi Big Bags entiers (1000 kg) pour Pavé 2 (décor)
  const isExactBigBag2 =
    numQte2 > 0 && Math.abs(bigBagsExact2 - Math.round(bigBagsExact2)) < 0.001;
  const floorBags2 = Math.max(1, Math.floor(bigBagsExact2));
  const ceilBags2 = Math.ceil(bigBagsExact2);
  const floorM2_2 = Math.round(floorBags2 * numM2t * 100) / 100;
  const ceilM2_2 = Math.round(ceilBags2 * numM2t * 100) / 100;

  // Noms des pavés sélectionnés
  const activePave1 = paveDb.find((p) => p.id === selectedPaveId1);
  const activePave2 = paveDb.find((p) => p.id === selectedPaveId2);

  // Sélection d'un pavé dans la base pour la Ligne 1
  const handleSelectPave1 = (id: string) => {
    setSelectedPaveId1(id);
    const found = paveDb.find((p) => p.id === id);
    if (found) {
      setPrixTonne1(found.prixTonne.toFixed(2));
      setM2Tonne(String(found.m2Tonne));
    }
  };

  // Sélection d'un pavé dans la base pour la Ligne 2 (décor)
  const handleSelectPave2 = (id: string) => {
    setSelectedPaveId2(id);
    const found = paveDb.find((p) => p.id === id);
    if (found) {
      setPrixTonne2(found.prixTonne.toFixed(2));
    }
  };

  // Modification en direct du tarif Camion Complet (sans bloquer la saisie, et active le camion si 0 camion)
  const handleChangePrixCamion = (valStr: string, activateTruckIfZero = false) => {
    setPrixCamionStr(valStr);
    if (activateTruckIfZero && nbCamionsComplets === 0) {
      setTransportMode('camion');
      setManualCamionsStr(String(forcedFullTrucksCount));
      setManualGroupageBagsStr('0');
    }
  };

  // Sauvegarder le tarif Camion Complet comme nouvelle référence dans la base Tarifs
  const handleSavePrixCamionToDb = (valStr: string) => {
    setPrixCamionStr(valStr);
    const parsed = parseFloat(valStr);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const nextTransport = { ...transportDb, prixCamionComplet24t: parsed };
      setTransportDb(nextTransport);
      syncTarifsToFirestore(paveDb, nextTransport);
    }
  };

  // Modification en direct du tarif Groupage €/tonne (sans bloquer la saisie)
  const handleChangePrixGroupage = (valStr: string) => {
    setPrixGroupageTonneStr(valStr);
  };

  // Sauvegarder le tarif Groupage comme nouvelle référence dans la base Tarifs
  const handleSavePrixGroupageToDb = (valStr: string) => {
    setPrixGroupageTonneStr(valStr);
    const parsed = parseFloat(valStr);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const nextTransport = { ...transportDb, prixGroupageTonne: parsed };
      setTransportDb(nextTransport);
      syncTarifsToFirestore(paveDb, nextTransport);
    }
  };

  const stepPrixCamion = (delta: number) => {
    const next = Math.max(0, Math.round((numPrixCamionComplet + delta) * 100) / 100);
    setPrixCamionStr(String(next));
    if (nbCamionsComplets === 0) {
      setTransportMode('camion');
      setManualCamionsStr(String(forcedFullTrucksCount));
      setManualGroupageBagsStr('0');
    }
  };

  const stepPrixGroupage = (delta: number) => {
    const next = Math.max(0, Math.round((numPrixGroupageTonne + delta) * 100) / 100);
    setPrixGroupageTonneStr(String(next));
  };

  const handleStepNbCamions = (delta: number) => {
    const nextCamions = Math.max(0, nbCamionsComplets + delta);
    const remainingBags = Math.max(
      0,
      totalWholeBagsToShip - nextCamions * capaciteCamion
    );
    setTransportMode('manuel');
    setManualCamionsStr(String(nextCamions));
    setManualGroupageBagsStr(String(remainingBags));
  };

  const handleStepGroupageBags = (delta: number) => {
    const nextBags = Math.max(0, deltaBagsGroupage + delta);
    setTransportMode('manuel');
    setManualCamionsStr(String(nbCamionsComplets));
    setManualGroupageBagsStr(String(nextBags));
  };

  // Mise à jour d'un tarif pavé dans la base de données Cloud
  const handleUpdateDbItemPrice = (id: string, newPriceStr: string) => {
    const val = parseFloat(newPriceStr);
    const cleanPrice = Number.isNaN(val) ? 0 : val;
    const nextList = paveDb.map((item) =>
      item.id === id ? { ...item, prixTonne: cleanPrice } : item
    );
    setPaveDb(nextList);
    syncTarifsToFirestore(nextList, transportDb);
    if (id === selectedPaveId1) {
      setPrixTonne1(String(cleanPrice));
    }
    if (id === selectedPaveId2) {
      setPrixTonne2(String(cleanPrice));
    }
  };

  const handleUpdateDbItemM2 = (id: string, newM2Str: string) => {
    const val = parseFloat(newM2Str);
    const cleanM2 = Number.isNaN(val) || val <= 0 ? 9.5 : val;
    const nextList = paveDb.map((item) =>
      item.id === id ? { ...item, m2Tonne: cleanM2 } : item
    );
    setPaveDb(nextList);
    syncTarifsToFirestore(nextList, transportDb);
    if (id === selectedPaveId1) {
      setM2Tonne(String(cleanM2));
    }
  };

  const handleAddPaveToDb = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPaveName.trim()) return;
    const prix = parseFloat(newPavePrix) || 0;
    const m2 =
      newPaveFinition === 'eclate'
        ? 9.5
        : newPaveFinition === 'rectifie'
        ? 10.0
        : parseFloat(newPaveM2) || 9.5;

    const newItem: PaveTarifItem = {
      id: `custom-${Date.now()}`,
      name: newPaveName.trim().slice(0, 150),
      finition: newPaveFinition,
      prixTonne: prix,
      m2Tonne: m2,
    };

    const nextList = [...paveDb, newItem];
    setPaveDb(nextList);
    syncTarifsToFirestore(nextList, transportDb);
    setNewPaveName('');
    setNewPavePrix('');
  };

  const handleDeleteDbItem = (id: string) => {
    const nextList = paveDb.filter((item) => item.id !== id);
    setPaveDb(nextList);
    syncTarifsToFirestore(nextList, transportDb);
  };

  const handleResetDatabase = () => {
    setPaveDb(DEFAULT_PAVE_DATABASE);
    setTransportDb(DEFAULT_TRANSPORT_TARIFS);
    setPrixCamionStr(String(DEFAULT_TRANSPORT_TARIFS.prixCamionComplet24t));
    setPrixGroupageTonneStr(String(DEFAULT_TRANSPORT_TARIFS.prixGroupageTonne));
    syncTarifsToFirestore(DEFAULT_PAVE_DATABASE, DEFAULT_TRANSPORT_TARIFS);
    if (selectedPaveId1 === 'gris-10x10x5-eclate') setPrixTonne1('62.50');
    if (selectedPaveId2 === 'jaune-10x10x5-eclate') setPrixTonne2('82.50');
  };

  // Boutons tactiles +/- optimisés pour mobile (1 Big Bag = numM2t m²)
  const stepQte1 = (deltaBags: number) => {
    const stepM2 = numM2t > 0 ? numM2t : 9.5;
    const next = Math.max(
      0,
      Math.round((numQte1 + deltaBags * stepM2) * 100) / 100
    );
    setQte1(String(next));
  };

  const stepPrixTonne1 = (delta: number) => {
    const next = Math.max(0, Math.round((numPrixTonne1 + delta) * 100) / 100);
    setPrixTonne1(next.toFixed(2));
    setSelectedPaveId1('custom');
  };

  const stepQte2 = (deltaBags: number) => {
    const stepM2 = numM2t > 0 ? numM2t : 9.5;
    const next = Math.max(
      0,
      Math.round((numQte2 + deltaBags * stepM2) * 100) / 100
    );
    setQte2(String(next));
  };

  const stepPrixTonne2 = (delta: number) => {
    const next = Math.max(0, Math.round((numPrixTonne2 + delta) * 100) / 100);
    setPrixTonne2(next.toFixed(2));
    setSelectedPaveId2('custom');
  };

  const stepM2Tonne = (delta: number) => {
    const next = Math.max(0.5, Math.round((numM2t + delta) * 10) / 10);
    setM2Tonne(String(next));
  };

  const stepCoef = (delta: number) => {
    const next = Math.max(1.0, Math.round((numCoef + delta) * 100) / 100);
    setCoef(next.toFixed(2));
  };

  const handleUpdateExtraLineLabel = (index: number, value: string) => {
    setExtraTlines((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, label: value } : item))
    );
  };

  const handleUpdateExtraLineAmount = (index: number, value: string) => {
    const parsed = parseFloat(value);
    setExtraTlines((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? { ...item, amount: Number.isNaN(parsed) ? 0 : parsed }
          : item
      )
    );
  };

  const handleRemoveExtraLine = (index: number) => {
    setExtraTlines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddExtraLine = (
    label = 'Transport complémentaire',
    amount = 0
  ) => {
    setExtraTlines((prev) => [
      ...prev,
      {
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        amount,
      },
    ]);
  };

  const handleReset = () => {
    const def1 =
      paveDb.find((p) => p.id === 'gris-10x10x5-eclate') ||
      DEFAULT_PAVE_DATABASE[0];
    const def2 =
      paveDb.find((p) => p.id === 'jaune-10x10x5-eclate') ||
      DEFAULT_PAVE_DATABASE[1];
    setSelectedPaveId1(def1.id);
    setQte1('0');
    setPrixTonne1(def1.prixTonne.toFixed(2));
    setSelectedPaveId2(def2.id);
    setQte2('0');
    setPrixTonne2(def2.prixTonne.toFixed(2));
    setM2Tonne(String(def1.m2Tonne));
    setCoef('1.50');
    setPrixCamionStr(String(transportDb.prixCamionComplet24t));
    setPrixGroupageTonneStr(String(transportDb.prixGroupageTonne));
    setTransportMode('auto');
    setManualCamionsStr('1');
    setManualGroupageBagsStr('0');
    setExtraTlines([]);
    setClientRef('livraison dépôt 77550');
  };

  // Texte descriptif client en TTC (sans détail de calcul interne), signé L'équipe Elaxam
  const labelPave1 = activePave1 ? activePave1.name : 'Pavé granit (principal)';
  const labelPave2 = activePave2 ? activePave2.name : 'Pavé granit (décor)';

  const clientProductLines: string[] = [
    `• ${labelPave1} : ${fmtCompact(numQte1)} m² (${wholeBags1} Big Bag${wholeBags1 > 1 ? 's' : ''} de 1 000 kg)${numQte2 > 0 ? ` — ${fmt(venteM2Ligne1TTC)} €/m² TTC` : ''}`,
  ];

  if (numQte2 > 0) {
    clientProductLines.push(
      `• ${labelPave2} : ${fmtCompact(numQte2)} m² (${wholeBags2} Big Bag${wholeBags2 > 1 ? 's' : ''} de 1 000 kg) — ${fmt(venteM2Ligne2TTC)} €/m² TTC`,
      `• Surface totale : ${fmtCompact(numQteTotal)} m² (soit ${totalWholeBagsToShip} Big Bags de 1 000 kg)`
    );
  }

  const clientShareText = [
    `Bonjour,`,
    ``,
    `Nous vous remercions pour votre demande et pour l'intérêt que vous portez à nos pavés en granit.`,
    `Voici notre proposition tarifaire TTC pour votre projet :`,
    ``,
    ...clientProductLines,
    ``,
    `• Prix au m² TTC : ${fmt(venteM2TTC)} €/m² TTC`,
    `• Prix de vente total TTC : ${fmt(venteTotalTTC)} € TTC`,
    ``,
    `Conditions de livraison :`,
    `Notre prix inclut la matière première (pavé granit) ainsi que le transport livré à votre adresse, sous réserve des accès poids lourd. Il vous appartient de prévoir sur place un engin de déchargement adapté pour décharger les Big Bags (1 000 kg) du camion.`,
    ``,
    `Nous restons à votre entière disposition pour toute question ou pour organiser votre livraison. En vous remerciant chaleureusement pour votre confiance, nous vous souhaitons une excellente journée.`,
    ``,
    `Bien cordialement,`,
    `L'équipe Elaxam`,
    `📞 07 444 11 666`,
    `✉️ accueil.home@gmail.com`,
  ].join('\n');

  const handleCopyClientText = async () => {
    try {
      await navigator.clipboard.writeText(clientShareText);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2400);
    } catch {
      // ignore
    }
  };

  const handleNativeShareClientText = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Proposition Pavés Granit — L'équipe Elaxam`,
          text: clientShareText,
        });
        return;
      } catch {
        // Fallback to clipboard if user cancels share sheet
      }
    }
    await handleCopyClientText();
  };

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawTitle =
      quoteTitle.trim() ||
      `Commande ${fmt(numQte1)} m²${numQte2 > 0 ? ` + ${fmt(numQte2)} m² décor` : ''} (${totalWholeBagsToShip} BB)`;
    const nowMs = Date.now();
    const newQ: SavedQuote = {
      id: `q-${nowMs}`,
      title: rawTitle.slice(0, 200),
      clientRef: (clientRef || 'livraison dépôt 77550').slice(0, 200),
      createdAt: new Date().toLocaleDateString('fr-FR').slice(0, 40),
      createdAtMs: nowMs,
      paveId1: (selectedPaveId1 || 'custom').slice(0, 128),
      paveName1: (activePave1?.name || 'Pavé granit 1').slice(0, 200),
      qte1: Math.min(100000, Math.max(0, numQte1)),
      prixTonne1: Math.min(100000, Math.max(0, numPrixTonne1)),
      paveId2: (selectedPaveId2 || 'custom').slice(0, 128),
      paveName2: (activePave2?.name || 'Pavé granit 2').slice(0, 200),
      qte2: Math.min(100000, Math.max(0, numQte2)),
      prixTonne2: Math.min(100000, Math.max(0, numPrixTonne2)),
      m2Tonne: Math.min(1000, Math.max(0.5, numM2t || 9.5)),
      coef: Math.min(20, Math.max(1, numCoef || 1.5)),
      prixCamionComplet24t: Math.min(100000, Math.max(0, numPrixCamionComplet)),
      prixGroupageTonne: Math.min(100000, Math.max(0, numPrixGroupageTonne)),
      transportMode,
      nbCamionsManuel: Math.min(500, Math.max(0, nbCamionsComplets)),
      nbGroupageBagsManuel: Math.min(5000, Math.max(0, deltaBagsGroupage)),
      extraTransportLines: extraTlines.slice(0, 30).map((l) => ({
        id: String(l.id).slice(0, 64),
        label: String(l.label).slice(0, 120),
        amount: Number(l.amount) || 0,
      })),
    };
    setSavedQuotes((prev) => {
      const updated = [newQ, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    setQuoteTitle('');
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2200);

    try {
      await setDoc(doc(db, 'quotes', newQ.id), newQ);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `quotes/${newQ.id}`);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    setSavedQuotes((prev) => {
      const updated = prev.filter((item) => item.id !== quoteId);
      try {
        localStorage.setItem(STORAGE_KEY_QUOTES, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    try {
      await deleteDoc(doc(db, 'quotes', quoteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `quotes/${quoteId}`);
    }
  };

  const handleLoadQuote = (q: SavedQuote) => {
    if (q.paveId1) {
      setSelectedPaveId1(q.paveId1);
    } else if (q.paveName1) {
      const match1 = paveDb.find((p) => p.name === q.paveName1);
      if (match1) setSelectedPaveId1(match1.id);
    }
    if (q.paveId2) {
      setSelectedPaveId2(q.paveId2);
    } else if (q.paveName2) {
      const match2 = paveDb.find((p) => p.name === q.paveName2);
      if (match2) setSelectedPaveId2(match2.id);
    }
    setQte1(String(q.qte1 ?? 218.5));
    setPrixTonne1((q.prixTonne1 ?? 62.5).toFixed(2));
    setQte2(String(q.qte2 ?? 0));
    setPrixTonne2((q.prixTonne2 ?? 82.5).toFixed(2));
    setM2Tonne(String(q.m2Tonne));
    setCoef(q.coef.toFixed(2));
    setPrixCamionStr(String(q.prixCamionComplet24t ?? transportDb.prixCamionComplet24t));
    setPrixGroupageTonneStr(
      String(q.prixGroupageTonne ?? transportDb.prixGroupageTonne)
    );
    if (q.transportMode) {
      setTransportMode(q.transportMode);
    } else {
      setTransportMode('auto');
    }
    if (typeof q.nbCamionsManuel === 'number') {
      setManualCamionsStr(String(q.nbCamionsManuel));
    }
    if (typeof q.nbGroupageBagsManuel === 'number') {
      setManualGroupageBagsStr(String(q.nbGroupageBagsManuel));
    }
    setClientRef(q.clientRef || 'livraison dépôt 77550');
    setExtraTlines(
      (q.extraTransportLines || []).map((l, idx) => ({
        ...l,
        id: l.id || `l-${idx}`,
      }))
    );
    setShowQuotesSheet(false);
  };

  return (
    <div>
      {/* VUE ÉCRAN MOBILE / TABLETTE / PC (Masquée à l'impression) */}
      <div className="screen-only">
        {/* Sticky Mini-Hero when scrolling down on smartphone */}
        {showStickyMiniHero && (
        <div className="sticky-mini-hero no-print">
          <div>
            <div style={{ fontSize: '10.5px', color: 'var(--hero-muted)' }}>
              {fmt(numQteTotal)} m² · {totalWholeBagsToShip} Big Bags ({totalWholeBagsToShip} t)
            </div>
            <div
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '17px',
                fontWeight: 600,
              }}
            >
              {fmt(venteM2)}{' '}
              <span style={{ fontSize: '11.5px', color: 'var(--hero-accent)' }}>
                €/m² HT
              </span>
              <span
                style={{
                  fontSize: '11.5px',
                  color: '#E2E8F0',
                  marginLeft: '6px',
                }}
              >
                ({fmt(venteM2TTC)} € TTC)
              </span>
            </div>
          </div>
          <div className="text-right">
            <div
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '12.5px',
                fontWeight: 600,
              }}
            >
              HT : {fmt(venteTotal)} €
            </div>
            <div
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '11.5px',
                color: 'var(--hero-accent)',
                fontWeight: 600,
              }}
            >
              TTC : {fmt(venteTotalTTC)} €
            </div>
          </div>
        </div>
      )}

      {/* Main Hero Card (Encadré bleu en haut avec coin TTC pour particuliers) */}
      <div className="hero">
        <div className="hero-top-row">
          <div className="hero-ht-main">
            <div className="label">Prix de vente HT au m² (moyen)</div>
            <div className="value" id="heroM2">
              {fmt(venteM2)} <span>€/m² HT</span>
            </div>
            <div className="hero-sub-meta">
              {fmt(numQteTotal)} m² · {totalWholeBagsToShip} Big Bags (1t)
            </div>
          </div>

          {/* Coin TTC dédié aux particuliers : Prix du m² TTC et Prix de vente total TTC */}
          <div className="hero-ttc-corner" id="heroTtcBox">
            <div className="ttc-badge">Particulier · TTC</div>
            <div className="ttc-m2">
              {fmt(venteM2TTC)} <span>€/m² TTC</span>
            </div>
            <div className="ttc-total">Total : {fmt(venteTotalTTC)} € TTC</div>
          </div>
        </div>

        {/* Détail prix de vente HT & TTC / m² par pavé lorsque les 2 lignes sont utilisées */}
        {numQte2 > 0 && (
          <div className="hero-split-rates">
            <div className="hero-rate-pill">
              <span className="rl">
                Pavé 1 ({fmt(numQte1)} m² · {wholeBags1} BB)
              </span>
              <span className="rv">
                {fmt(venteM2Ligne1)} € HT · {fmt(venteM2Ligne1TTC)} € TTC/m²
              </span>
            </div>
            <div className="hero-rate-pill">
              <span className="rl">
                Pavé 2 décor ({fmt(numQte2)} m² · {wholeBags2} BB)
              </span>
              <span className="rv">
                {fmt(venteM2Ligne2)} € HT · {fmt(venteM2Ligne2TTC)} € TTC/m²
              </span>
            </div>
          </div>
        )}

        <div className="sub">
          <div className="stat-box">
            <div className="l">Prix de vente HT total</div>
            <div className="v" id="heroTotal">
              {fmt(venteTotal)} € HT
            </div>
          </div>
          <div className="stat-box">
            <div className="l">Marge totale HT</div>
            <div className="v marge-val" id="heroMarge">
              +{fmt(margeTotal)} € HT
            </div>
          </div>
        </div>
      </div>

      {/* Produit Card — Deux lignes de quantité commandée + Base de données des prix + Calcul Big Bags */}
      <div className="card">
        <h2>
          <span className="t">
            <span className="dot"></span>Produit & Big Bags (1000 kg)
          </span>
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={() => setShowDbSheet(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
              }}
              title="Ouvrir et mettre à jour la base de données des tarifs (pavés & transport)"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Tarifs ({paveDb.length})</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-transparent border border-[var(--line)] cursor-pointer"
              style={{ color: 'var(--stone)' }}
              title="Réinitialiser les valeurs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </h2>

        {/* Ligne 1 : Pavé principal */}
        <div className="pave-block">
          <div className="pave-block-header">
            <span>1. Pavé principal</span>
            <span className="sub-info">
              {wholeBags1} Big Bag{wholeBags1 > 1 ? 's' : ''} ({wholeBags1} t) ·{' '}
              {fmt(coutGranit1)} € HT
            </span>
          </div>

          {/* Sélecteur issu de la base de données */}
          <div className="pave-select-wrap no-print">
            <select
              className="pave-select"
              value={selectedPaveId1}
              onChange={(e) => handleSelectPave1(e.target.value)}
              aria-label="Choisir le pavé principal dans la base de données"
            >
              {paveDb.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {fmt(item.prixTonne)} €/t (
                  {item.m2Tonne.toString().replace('.', ',')} m²/BB)
                </option>
              ))}
              <option value="custom">Tarif libre / personnalisé</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="qte1">
              <span>Quantité commandée 1</span>
              <span
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '11px',
                }}
              >
                Vente : {fmt(venteM2Ligne1)} €/m² HT
              </span>
            </label>
            <div className="input-row">
              <input
                type="number"
                id="qte1"
                inputMode="decimal"
                step="0.5"
                value={qte1}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQte1(e.target.value)}
              />
              <span className="unit">m²</span>
              <div className="stepper-group no-print">
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => stepQte1(-1)}
                  aria-label="Moins 1 Big Bag"
                  title={`-1 Big Bag (-${numM2t} m²)`}
                >
                  −
                </button>
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => stepQte1(1)}
                  aria-label="Plus 1 Big Bag"
                  title={`+1 Big Bag (+${numM2t} m²)`}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="prixTonne1">
              <span>Prix HT à la tonne (Pavé 1)</span>
              <span
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '11px',
                }}
              >
                soit {fmt(prixGranit1M2)} €/m²
              </span>
            </label>
            <div className="input-row">
              <input
                type="number"
                id="prixTonne1"
                inputMode="decimal"
                step="0.50"
                value={prixTonne1}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  setPrixTonne1(e.target.value);
                  setSelectedPaveId1('custom');
                }}
              />
              <span className="unit">€/t</span>
              <div className="stepper-group no-print">
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => stepPrixTonne1(-2.5)}
                  aria-label="Moins 2,50 €/t"
                >
                  −
                </button>
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => stepPrixTonne1(2.5)}
                  aria-label="Plus 2,50 €/t"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Calculateur Big Bag entier (1000 kg = 1 tonne) pour Pavé 1 */}
          {numQte1 > 0 && numM2t > 0 && (
            <div className="bigbag-box">
              <div className="bigbag-exact-row">
                <span>
                  Calcul : {fmtCompact(numQte1)} m² ÷{' '}
                  {numM2t.toString().replace('.', ',')} m² =
                </span>
                <strong>
                  {fmt(bigBagsExact1)} Big Bags ({fmt(bigBagsExact1)} t)
                </strong>
              </div>

              {isExactBigBag1 ? (
                <div>
                  <div className="bigbag-exact-badge">
                    <span className="inline-flex items-center gap-1.5">
                      <PackageCheck className="w-4 h-4" />
                      Compte juste : {Math.round(bigBagsExact1)} Big Bag
                      {Math.round(bigBagsExact1) > 1 ? 's' : ''} de 1000 kg (
                      {Math.round(bigBagsExact1)} t)
                    </span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      = {fmtCompact(numQte1)} m²
                    </span>
                  </div>
                  <div className="bigbag-grid no-print">
                    {Math.round(bigBagsExact1) > 1 && (
                      <button
                        type="button"
                        className="bigbag-btn"
                        onClick={() =>
                          setQte1(
                            String(
                              Math.round(
                                (Math.round(bigBagsExact1) - 1) * numM2t * 100
                              ) / 100
                            )
                          )
                        }
                      >
                        <span className="bb-tag">1 Big Bag de moins</span>
                        <span className="bb-bags">
                          {Math.round(bigBagsExact1) - 1} Big Bags (
                          {Math.round(bigBagsExact1) - 1} t)
                        </span>
                        <span className="bb-m2">
                          ={' '}
                          {fmtCompact(
                            Math.round(
                              (Math.round(bigBagsExact1) - 1) * numM2t * 100
                            ) / 100
                          )}{' '}
                          m²
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="bigbag-btn"
                      onClick={() =>
                        setQte1(
                          String(
                            Math.round(
                              (Math.round(bigBagsExact1) + 1) * numM2t * 100
                            ) / 100
                          )
                        )
                      }
                    >
                      <span className="bb-tag">1 Big Bag de plus (+1t)</span>
                      <span className="bb-bags">
                        {Math.round(bigBagsExact1) + 1} Big Bags (
                        {Math.round(bigBagsExact1) + 1} t)
                      </span>
                      <span className="bb-m2">
                        ={' '}
                        {fmtCompact(
                          Math.round(
                            (Math.round(bigBagsExact1) + 1) * numM2t * 100
                          ) / 100
                        )}{' '}
                        m²
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--clay)',
                      marginBottom: '6px',
                    }}
                  >
                    Conditionnement par Big Bag entier de 1000 kg (1t) — touchez
                    pour ajuster :
                  </div>
                  <div className="bigbag-grid">
                    <button
                      type="button"
                      className="bigbag-btn"
                      onClick={() => setQte1(String(floorM2_1))}
                    >
                      <span className="bb-tag">Arrondi inférieur</span>
                      <span className="bb-bags">
                        {floorBags1} Big Bag{floorBags1 > 1 ? 's' : ''} (
                        {floorBags1} t)
                      </span>
                      <span className="bb-m2">= {fmtCompact(floorM2_1)} m²</span>
                    </button>

                    <button
                      type="button"
                      className="bigbag-btn recommended"
                      onClick={() => setQte1(String(ceilM2_1))}
                    >
                      <span className="bb-tag">+1 Big Bag (Recommandé)</span>
                      <span className="bb-bags">
                        {ceilBags1} Big Bag{ceilBags1 > 1 ? 's' : ''} (
                        {ceilBags1} t)
                      </span>
                      <span className="bb-m2">= {fmtCompact(ceilM2_1)} m²</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ligne 2 : Pavé décor / 2e choix */}
        <div className="pave-block decor-block">
          <div className="pave-block-header">
            <span>2. Pavé décor / 2e choix (Noir, Jaune...)</span>
            <span className="sub-info">
              {wholeBags2} Big Bag{wholeBags2 > 1 ? 's' : ''} ({wholeBags2} t) ·{' '}
              {fmt(coutGranit2)} € HT
            </span>
          </div>

          {/* Sélecteur issu de la base de données pour le Pavé 2 */}
          <div className="pave-select-wrap no-print">
            <select
              className="pave-select"
              value={selectedPaveId2}
              onChange={(e) => handleSelectPave2(e.target.value)}
              aria-label="Choisir le pavé décor dans la base de données"
            >
              {paveDb.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {fmt(item.prixTonne)} €/t (
                  {item.m2Tonne.toString().replace('.', ',')} m²/BB)
                </option>
              ))}
              <option value="custom">Tarif libre / personnalisé</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="qte2">
              <span>Quantité commandée 2 (décor)</span>
              <span
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '11px',
                }}
              >
                {numQte2 > 0
                  ? `Vente : ${fmt(venteM2Ligne2)} €/m² HT`
                  : 'Optionnel (0 m²)'}
              </span>
            </label>
            <div className="input-row">
              <input
                type="number"
                id="qte2"
                inputMode="decimal"
                step="0.5"
                value={qte2}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQte2(e.target.value)}
              />
              <span className="unit">m²</span>
              <div className="stepper-group no-print">
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => stepQte2(-1)}
                  aria-label="Moins 1 Big Bag"
                  title={`-1 Big Bag (-${numM2t} m²)`}
                >
                  −
                </button>
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => stepQte2(1)}
                  aria-label="Plus 1 Big Bag"
                  title={`+1 Big Bag (+${numM2t} m²)`}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="prixTonne2">
              <span>Prix HT à la tonne (Pavé 2 décor)</span>
              <span
                style={{
                  fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '11px',
                }}
              >
                soit {fmt(prixGranit2M2)} €/m²
              </span>
            </label>
            <div className="input-row">
              <input
                type="number"
                id="prixTonne2"
                inputMode="decimal"
                step="0.50"
                value={prixTonne2}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  setPrixTonne2(e.target.value);
                  setSelectedPaveId2('custom');
                }}
              />
              <span className="unit">€/t</span>
              <div className="stepper-group no-print">
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => stepPrixTonne2(-2.5)}
                  aria-label="Moins 2,50 €/t"
                >
                  −
                </button>
                <button
                  type="button"
                  className="step-btn"
                  onClick={() => stepPrixTonne2(2.5)}
                  aria-label="Plus 2,50 €/t"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Calculateur Big Bag entier (1000 kg = 1 tonne) pour Pavé 2 décor */}
          {numQte2 > 0 && numM2t > 0 && (
            <div className="bigbag-box">
              <div className="bigbag-exact-row">
                <span>
                  Calcul décor : {fmtCompact(numQte2)} m² ÷{' '}
                  {numM2t.toString().replace('.', ',')} m² =
                </span>
                <strong>
                  {fmt(bigBagsExact2)} Big Bag{bigBagsExact2 >= 2 ? 's' : ''} (
                  {fmt(bigBagsExact2)} t)
                </strong>
              </div>

              {isExactBigBag2 ? (
                <div className="bigbag-exact-badge" style={{ marginBottom: 0 }}>
                  <span className="inline-flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4" />
                    Compte juste : {Math.round(bigBagsExact2)} Big Bag
                    {Math.round(bigBagsExact2) > 1 ? 's' : ''} de 1000 kg (
                    {Math.round(bigBagsExact2)} t)
                  </span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    = {fmtCompact(numQte2)} m²
                  </span>
                </div>
              ) : (
                <div className="bigbag-grid">
                  <button
                    type="button"
                    className="bigbag-btn"
                    onClick={() => setQte2(String(floorM2_2))}
                  >
                    <span className="bb-tag">Arrondi inférieur</span>
                    <span className="bb-bags">
                      {floorBags2} Big Bag{floorBags2 > 1 ? 's' : ''} (
                      {floorBags2} t)
                    </span>
                    <span className="bb-m2">= {fmtCompact(floorM2_2)} m²</span>
                  </button>

                  <button
                    type="button"
                    className="bigbag-btn recommended"
                    onClick={() => setQte2(String(ceilM2_2))}
                  >
                    <span className="bb-tag">+1 Big Bag entier</span>
                    <span className="bb-bags">
                      {ceilBags2} Big Bag{ceilBags2 > 1 ? 's' : ''} (
                      {ceilBags2} t)
                    </span>
                    <span className="bb-m2">= {fmtCompact(ceilM2_2)} m²</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Surface couverte par tonne (1 Big Bag = 1000 kg = 1 tonne) */}
        <div className="field">
          <label htmlFor="m2Tonne">
            <span>Surface couverte par tonne (1 Big Bag = 1000 kg)</span>
            <span
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '11.5px',
                color: 'var(--accent)',
                fontWeight: 600,
              }}
            >
              Total à charger : {totalWholeBagsToShip} Big Bags (
              {totalWholeBagsToShip} t)
            </span>
          </label>

          {/* Boutons rapides : 9,5 m²/t (10x10x5 Éclaté) vs 10 m²/t (10x10x5 Rectifié) */}
          <div className="grid grid-cols-2 gap-2 mb-2 no-print">
            <button
              type="button"
              onClick={() => setM2Tonne('9.5')}
              className={`chip ${Math.abs(numM2t - 9.5) < 0.01 ? 'active' : ''}`}
              style={{ width: '100%', fontSize: '12px', padding: '7px 8px' }}
            >
              10×10×5 Éclaté : 9,5 m²/BB
            </button>
            <button
              type="button"
              onClick={() => setM2Tonne('10')}
              className={`chip ${Math.abs(numM2t - 10) < 0.01 ? 'active' : ''}`}
              style={{ width: '100%', fontSize: '12px', padding: '7px 8px' }}
            >
              10×10×5 Rectifié : 10 m²/BB
            </button>
          </div>

          <div className="input-row">
            <input
              type="number"
              id="m2Tonne"
              inputMode="decimal"
              step="0.5"
              value={m2Tonne}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setM2Tonne(e.target.value)}
            />
            <span className="unit">m² / Big Bag (1t)</span>
            <div className="stepper-group no-print">
              <button
                type="button"
                className="step-btn"
                onClick={() => stepM2Tonne(-0.5)}
                aria-label="Moins 0,5 m²/t"
              >
                −
              </button>
              <button
                type="button"
                className="step-btn"
                onClick={() => stepM2Tonne(0.5)}
                aria-label="Plus 0,5 m²/t"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transport Card — Choix libre ou Automatique (Camion complet 2050€ réf. vs Groupage 150€/t réf.) */}
      <div className="card transport">
        <h2>
          <span className="t">
            <span className="dot"></span>Transport ({totalWholeBagsToShip} Big
            Bags · {totalWholeBagsToShip} tonnes)
          </span>
          <span
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '12px',
              color: 'var(--clay)',
              fontWeight: 600,
            }}
          >
            {numQteTotal > 0 ? `${fmt(coutTransportM2)} €/m²` : `${fmt(coutTransport)} € HT`}
          </span>
        </h2>

        {/* Sélecteur de Mode de Transport (Auto le + intéressant / Camion complet / Groupage / 24t+Delta) */}
        <div className="mb-3 no-print">
          <div
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--stone)',
              marginBottom: '6px',
            }}
          >
            Mode de calcul du transport (modifiable à tout moment) :
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTransportMode('auto')}
              className={`chip ${transportMode === 'auto' ? 'active' : ''}`}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '11.5px',
                justifyContent: 'space-between',
              }}
            >
              <span>Auto (Le + intéressant)</span>
              <strong>
                {fmtCompact(
                  autoCamions * numPrixCamionComplet +
                    autoGroupageBags * numPrixGroupageTonne
                )}{' '}
                €
              </strong>
            </button>

            <button
              type="button"
              onClick={() => {
                setTransportMode('camion');
                setManualCamionsStr(String(forcedFullTrucksCount));
                setManualGroupageBagsStr('0');
              }}
              className={`chip ${transportMode === 'camion' ? 'active' : ''}`}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '11.5px',
                justifyContent: 'space-between',
              }}
            >
              <span>
                Camion complet ({forcedFullTrucksCount}×)
              </span>
              <strong>{fmtCompact(coutOptionCamionComplet)} €</strong>
            </button>

            <button
              type="button"
              onClick={() => {
                setTransportMode('groupage');
                setManualCamionsStr('0');
                setManualGroupageBagsStr(String(totalWholeBagsToShip));
              }}
              className={`chip ${transportMode === 'groupage' ? 'active' : ''}`}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '11.5px',
                justifyContent: 'space-between',
              }}
            >
              <span>Tout Groupage ({totalWholeBagsToShip}t)</span>
              <strong>{fmtCompact(coutOptionToutGroupage)} €</strong>
            </button>

            <button
              type="button"
              onClick={() => {
                setTransportMode('strict24');
                setManualCamionsStr(String(strictFullTrucks));
                setManualGroupageBagsStr(String(strictRemainderBags));
              }}
              className={`chip ${transportMode === 'strict24' ? 'active' : ''}`}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '11.5px',
                justifyContent: 'space-between',
              }}
            >
              <span>
                Tranche {capaciteCamion}t + Delta ({strictFullTrucks}C+{strictRemainderBags}t)
              </span>
              <strong>
                {fmtCompact(
                  strictFullTrucks * numPrixCamionComplet +
                    strictRemainderBags * numPrixGroupageTonne
                )}{' '}
                €
              </strong>
            </button>
          </div>
        </div>

        {/* Bandeau d'explication et alerte d'optimisation (ex: 200 m² = 22 BB -> Camion complet plus avantageux que Groupage) */}
        <div
          className="p-3 rounded-2xl mb-3 flex flex-col gap-1.5"
          style={{
            background: 'var(--clay-soft)',
            border: '1px solid #FCD34D',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Truck
                className="w-4 h-4 shrink-0"
                style={{ color: 'var(--clay)' }}
              />
              <div style={{ fontSize: '12px', color: 'var(--ink)' }}>
                <strong>
                  {totalWholeBagsToShip} Big Bags ({totalWholeBagsToShip} t)
                </strong>{' '}
                → Retenu :{' '}
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                  {nbCamionsComplets} camion{nbCamionsComplets > 1 ? 's' : ''}{' '}
                  complet{nbCamionsComplets > 1 ? 's' : ''}
                </span>{' '}
                +{' '}
                <span style={{ fontWeight: 700, color: 'var(--clay)' }}>
                  {deltaBagsGroupage} BB ({deltaBagsGroupage} t) en Groupage
                </span>
              </div>
            </div>
          </div>

          {isFullTruckCheaperForRemainder && (
            <div
              style={{
                fontSize: '11.5px',
                color: 'var(--accent)',
                fontWeight: 600,
                borderTop: '1px dashed #FCD34D',
                paddingTop: '5px',
              }}
            >
              💡 Astuce : Pour {strictRemainderBags} Big Bags, 1 camion complet (
              {fmtCompact(numPrixCamionComplet)} €) est plus intéressant que le
              groupage ({strictRemainderBags} × {fmtCompact(numPrixGroupageTonne)}{' '}
              € = {fmtCompact(strictRemainderBags * numPrixGroupageTonne)} €, soit{' '}
              <strong>
                −
                {fmtCompact(
                  strictRemainderBags * numPrixGroupageTonne -
                    numPrixCamionComplet
                )}{' '}
                € HT d&apos;économie
              </strong>
              ).
            </div>
          )}
        </div>

        {/* Ligne 1 : Camion complet (Prix réf 2050 € modifiable à tout moment + Nombre de camions modifiable) */}
        <div
          className="pave-block"
          style={{
            marginBottom: '10px',
            background: nbCamionsComplets > 0 ? 'var(--accent-soft)' : 'var(--bg)',
            borderColor:
              nbCamionsComplets > 0 ? 'var(--accent)' : 'var(--line)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <span
                style={{
                  fontFamily: 'Archivo, sans-serif',
                  fontSize: '13.5px',
                  fontWeight: 700,
                }}
              >
                1. Camion complet (jusqu&apos;à {capaciteCamion} Big Bags /{' '}
                {capaciteCamion}t)
              </span>
              <div style={{ fontSize: '11px', color: 'var(--stone)' }}>
                Tarif de référence : {fmtCompact(transportDb.prixCamionComplet24t)} € HT
                (modifiable librement ci-dessous)
              </div>
            </div>
            <span
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '14px',
                fontWeight: 700,
                color: nbCamionsComplets > 0 ? 'var(--accent)' : 'var(--stone)',
              }}
            >
              {fmt(coutCamionsComplets)} € HT
            </span>
          </div>

          {/* Contrôle du nombre de camions complets + Saisie directe du prix du camion complet */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
            {/* Nombre de camions complets */}
            <div
              className="flex items-center justify-between p-2 rounded-xl"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600 }}>
                Nb de camions :
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="step-btn no-print"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() => handleStepNbCamions(-1)}
                  aria-label="Moins 1 camion complet"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={nbCamionsComplets}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    const rem = Math.max(
                      0,
                      totalWholeBagsToShip - val * capaciteCamion
                    );
                    setTransportMode('manuel');
                    setManualCamionsStr(String(val));
                    setManualGroupageBagsStr(String(rem));
                  }}
                  style={{
                    width: '46px',
                    textAlign: 'center',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontWeight: 700,
                    fontSize: '14.5px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                  aria-label="Nombre de camions complets"
                />
                <button
                  type="button"
                  className="step-btn no-print"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() => handleStepNbCamions(1)}
                  aria-label="Plus 1 camion complet"
                >
                  +
                </button>
              </div>
            </div>

            {/* Prix unitaire du camion complet (modifiable à tout moment) */}
            <div
              className="flex items-center justify-between p-2 rounded-xl"
              style={{
                background: 'var(--surface)',
                border: '1.5px solid var(--accent)',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600 }}>
                Prix Camion :
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  step="10"
                  value={prixCamionStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleChangePrixCamion(e.target.value, true)}
                  style={{
                    width: '78px',
                    border: 'none',
                    background: 'transparent',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontWeight: 700,
                    fontSize: '15px',
                    padding: '2px 0',
                    textAlign: 'right',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                  aria-label="Tarif camion complet HT"
                />
                <span
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: '12px',
                    color: 'var(--stone)',
                  }}
                >
                  €
                </span>
                <div className="flex items-center gap-1 ml-1 no-print">
                  <button
                    type="button"
                    className="step-btn"
                    style={{ width: '28px', height: '28px', fontSize: '14px' }}
                    onClick={() => stepPrixCamion(-50)}
                    title="-50 €"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="step-btn"
                    style={{ width: '28px', height: '28px', fontSize: '14px' }}
                    onClick={() => stepPrixCamion(50)}
                    title="+50 €"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Boutons rapides sous Camion Complet : Remettre à 2050 € réf ou Activer 1 camion complet */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 no-print">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPrixCamionStr('2050')}
                className="chip"
                style={{
                  padding: '4px 9px',
                  fontSize: '11px',
                  opacity: Math.abs(numPrixCamionComplet - 2050) < 0.01 ? 0.6 : 1,
                }}
              >
                Réf : 2 050 €
              </button>
              {Math.abs(numPrixCamionComplet - transportDb.prixCamionComplet24t) >
                0.01 && (
                <button
                  type="button"
                  onClick={() => handleSavePrixCamionToDb(prixCamionStr)}
                  className="chip"
                  style={{
                    padding: '4px 9px',
                    fontSize: '11px',
                    color: 'var(--accent)',
                    borderColor: 'var(--accent)',
                  }}
                >
                  Sauver {fmtCompact(numPrixCamionComplet)} € en réf.
                </button>
              )}
            </div>

            {nbCamionsComplets === 0 && (
              <button
                type="button"
                onClick={() => {
                  setTransportMode('camion');
                  setManualCamionsStr('1');
                  setManualGroupageBagsStr('0');
                }}
                className="chip active"
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                Forcer 1 Camion complet ({fmtCompact(numPrixCamionComplet)} €)
              </button>
            )}
          </div>
        </div>

        {/* Ligne 2 : Groupage (Prix réf 150 €/t modifiable à tout moment + Nombre de Big Bags modifiable) */}
        <div
          className="pave-block"
          style={{
            marginBottom: '10px',
            background: deltaBagsGroupage > 0 ? '#FFFBEB' : 'var(--bg)',
            borderColor: deltaBagsGroupage > 0 ? '#FCD34D' : 'var(--line)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <span
                style={{
                  fontFamily: 'Archivo, sans-serif',
                  fontSize: '13.5px',
                  fontWeight: 700,
                }}
              >
                2. Transport Groupage (au Big Bag / à la tonne)
              </span>
              <div style={{ fontSize: '11px', color: 'var(--stone)' }}>
                Tarif de référence : {fmtCompact(transportDb.prixGroupageTonne)} €/t
                (modifiable librement ci-dessous)
              </div>
            </div>
            <span
              style={{
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: '14px',
                fontWeight: 700,
                color: deltaBagsGroupage > 0 ? 'var(--clay)' : 'var(--stone)',
              }}
            >
              {fmt(coutGroupageDelta)} € HT
            </span>
          </div>

          {/* Contrôle du nombre de Big Bags (tonnes) en groupage + Saisie directe du prix €/t */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
            {/* Nombre de Big Bags (tonnes) en groupage */}
            <div
              className="flex items-center justify-between p-2 rounded-xl"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--line)',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600 }}>
                Big Bags (tonnes) :
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="step-btn no-print"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() => handleStepGroupageBags(-1)}
                  aria-label="Moins 1 Big Bag en groupage"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={deltaBagsGroupage}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    setTransportMode('manuel');
                    setManualCamionsStr(String(nbCamionsComplets));
                    setManualGroupageBagsStr(String(val));
                  }}
                  style={{
                    width: '46px',
                    textAlign: 'center',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontWeight: 700,
                    fontSize: '14.5px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--ink)',
                    outline: 'none',
                  }}
                  aria-label="Nombre de Big Bags en groupage"
                />
                <button
                  type="button"
                  className="step-btn no-print"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() => handleStepGroupageBags(1)}
                  aria-label="Plus 1 Big Bag en groupage"
                >
                  +
                </button>
              </div>
            </div>

            {/* Prix à la tonne en groupage (modifiable à tout moment) */}
            <div
              className="flex items-center justify-between p-2 rounded-xl"
              style={{
                background: 'var(--surface)',
                border: '1.5px solid #F59E0B',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600 }}>
                Prix Groupage :
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  step="5"
                  value={prixGroupageTonneStr}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handleChangePrixGroupage(e.target.value)}
                  style={{
                    width: '68px',
                    border: 'none',
                    background: 'transparent',
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontWeight: 700,
                    fontSize: '15px',
                    padding: '2px 0',
                    textAlign: 'right',
                    color: 'var(--clay)',
                    outline: 'none',
                  }}
                  aria-label="Tarif groupage par tonne"
                />
                <span
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: '11.5px',
                    color: 'var(--stone)',
                  }}
                >
                  €/t
                </span>
                <div className="flex items-center gap-1 ml-1 no-print">
                  <button
                    type="button"
                    className="step-btn"
                    style={{ width: '28px', height: '28px', fontSize: '14px' }}
                    onClick={() => stepPrixGroupage(-5)}
                    title="-5 €/t"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="step-btn"
                    style={{ width: '28px', height: '28px', fontSize: '14px' }}
                    onClick={() => stepPrixGroupage(5)}
                    title="+5 €/t"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Boutons rapides sous Groupage : Remettre à 150 €/t réf ou Mettre groupage à 0 */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 no-print">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPrixGroupageTonneStr('150')}
                className="chip"
                style={{
                  padding: '4px 9px',
                  fontSize: '11px',
                  opacity:
                    Math.abs(numPrixGroupageTonne - 150) < 0.01 ? 0.6 : 1,
                }}
              >
                Réf : 150 €/t
              </button>
              {Math.abs(numPrixGroupageTonne - transportDb.prixGroupageTonne) >
                0.01 && (
                <button
                  type="button"
                  onClick={() =>
                    handleSavePrixGroupageToDb(prixGroupageTonneStr)
                  }
                  className="chip"
                  style={{
                    padding: '4px 9px',
                    fontSize: '11px',
                    color: 'var(--clay)',
                    borderColor: 'var(--clay)',
                  }}
                >
                  Sauver {fmtCompact(numPrixGroupageTonne)} €/t en réf.
                </button>
              )}
            </div>

            {deltaBagsGroupage > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTransportMode('manuel');
                  setManualCamionsStr(String(Math.max(1, nbCamionsComplets)));
                  setManualGroupageBagsStr('0');
                }}
                className="chip"
                style={{ padding: '4px 10px', fontSize: '11px' }}
              >
                Mettre Groupage à 0 BB (Camion complet)
              </button>
            )}
          </div>
        </div>

        {/* Lignes de transport supplémentaires éventuelles */}
        {extraTlines.length > 0 && (
          <div id="tlines" className="mt-2">
            {extraTlines.map((line, i) => (
              <div className="tline" key={line.id}>
                <input
                  className="tlabel"
                  type="text"
                  value={line.label}
                  placeholder="Libellé transport"
                  onChange={(e) => handleUpdateExtraLineLabel(i, e.target.value)}
                />
                <div className="tamount-wrap">
                  <input
                    className="tamount"
                    type="number"
                    inputMode="decimal"
                    value={line.amount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      handleUpdateExtraLineAmount(i, e.target.value)
                    }
                  />
                  <span className="tamount-unit">€</span>
                </div>
                <button
                  className="rm"
                  type="button"
                  onClick={() => handleRemoveExtraLine(i)}
                  aria-label="Supprimer la ligne"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          className="addline"
          id="addline"
          type="button"
          onClick={() => handleAddExtraLine('Transport complémentaire', 0)}
        >
          + ajouter une ligne de transport
        </button>

        <div className="tsum">
          <span>
            Total transport HT ({nbCamionsComplets} camion
            {nbCamionsComplets > 1 ? 's' : ''} × {fmtCompact(numPrixCamionComplet)}{' '}
            € + {deltaBagsGroupage} BB × {fmtCompact(numPrixGroupageTonne)} €/t)
          </span>
          <b id="transportSum">{fmt(coutTransport)} €</b>
        </div>
      </div>

      {/* Marge Card */}
      <div className="card">
        <h2>
          <span className="t">
            <span className="dot"></span>Marge
          </span>
          <span
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '12px',
              color: 'var(--accent)',
              fontWeight: 600,
            }}
          >
            +{Math.round((numCoef - 1) * 100)} % sur revient
          </span>
        </h2>

        <div className="field">
          <label htmlFor="coef">Coefficient multiplicateur</label>
          <div className="input-row">
            <input
              type="number"
              id="coef"
              inputMode="decimal"
              step="0.05"
              value={coef}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setCoef(e.target.value)}
            />
            <span className="unit">×</span>
            <div className="stepper-group no-print">
              <button
                type="button"
                className="step-btn"
                onClick={() => stepCoef(-0.05)}
                aria-label="Moins 0,05"
              >
                −
              </button>
              <button
                type="button"
                className="step-btn"
                onClick={() => stepCoef(0.05)}
                aria-label="Plus 0,05"
              >
                +
              </button>
            </div>
          </div>

          <div className="chips" id="coefChips">
            {COEFS.map((c) => {
              const isActive = Math.abs(c - numCoef) < 0.001;
              return (
                <button
                  key={c}
                  type="button"
                  className={`chip ${isActive ? 'active' : ''}`}
                  onClick={() => setCoef(c.toFixed(2))}
                >
                  {c.toFixed(2).replace('.', ',')}×
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Détail du calcul Card */}
      <div className="card">
        <h2>
          <span className="t">
            <span className="dot"></span>Détail du calcul
          </span>
        </h2>
        <div className="results-grid">
          <div className="result">
            <div className="l">Coût granit total</div>
            <div className="v" id="rGranit">
              {fmt(coutGranit)} €
            </div>
            <div className="sub-v">
              {numQte2 > 0
                ? `P1: ${fmt(coutGranit1)} € · P2: ${fmt(coutGranit2)} €`
                : `${totalWholeBagsToShip} Big Bags (1000 kg)`}
            </div>
          </div>
          <div className="result">
            <div className="l">Coût transport total</div>
            <div className="v" id="rTransport">
              {fmt(coutTransport)} €
            </div>
            <div className="sub-v">
              {nbCamionsComplets}×{capaciteCamion}t ({fmtCompact(coutCamionsComplets)} €) +{' '}
              {deltaBagsGroupage}t ({fmtCompact(coutGroupageDelta)} €)
            </div>
          </div>
          <div className="result">
            <div className="l">Coût de revient total</div>
            <div className="v" id="rRevient">
              {fmt(coutRevientTotal)} €
            </div>
            <div className="sub-v">
              {fmt(numQteTotal)} m² ({totalWholeBagsToShip} Big Bags)
            </div>
          </div>
          <div className="result">
            <div className="l">Coût de revient au m²</div>
            <div className="v" id="rRevientM2">
              {fmt(coutRevientM2)} €
            </div>
            <div className="sub-v">moyen pondéré HT</div>
          </div>
        </div>
      </div>

      {/* Comparatif coefficients de marge Card */}
      <div className="card">
        <h2>
          <span className="t">
            <span className="dot"></span>Comparatif coefficients de marge
          </span>
          <span
            className="no-print"
            style={{ fontSize: '11px', fontWeight: 500, color: 'var(--stone)' }}
          >
            Touchez une ligne pour choisir
          </span>
        </h2>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Coef.</th>
                <th>€/m²</th>
                <th>Total HT</th>
                <th>Marge</th>
              </tr>
            </thead>
            <tbody id="coefTable">
              {COEFS.map((c) => {
                const tot = coutRevientTotal * c;
                const m2 = numQteTotal ? tot / numQteTotal : 0;
                const marge = tot - coutRevientTotal;
                const isCurrent = Math.abs(c - numCoef) < 0.001;
                return (
                  <tr
                    key={c}
                    className={`coef-row ${isCurrent ? 'current' : ''}`}
                    onClick={() => setCoef(c.toFixed(2))}
                  >
                    <td>{c.toFixed(2).replace('.', ',')}×</td>
                    <td>{fmt(m2)}</td>
                    <td>{fmt(tot)}</td>
                    <td>+{fmt(marge)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <footer>
        Tous les prix affichés sont hors taxes (HT) — {clientRef}
      </footer>

      {/* Base de données des Tarifs (Transport + Pavés €/Tonne) — Éditable mensuellement / annuellement */}
      {showDbSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center no-print"
          style={{
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowDbSheet(false)}
        >
          <div
            className="w-full max-w-[520px] rounded-t-3xl p-5 max-h-[88dvh] overflow-y-auto"
            style={{
              background: 'var(--surface)',
              borderTop: '1px solid var(--line)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-10 h-1.5 rounded-full mx-auto mb-4"
              style={{ background: 'var(--stone-soft)' }}
            />
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3
                  style={{
                    fontFamily: 'Archivo, sans-serif',
                    fontSize: '17px',
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  Base de données — Tarifs Pavés & Transport
                </h3>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--stone)',
                    margin: '2px 0 0',
                  }}
                >
                  Mise à jour mensuelle / annuelle (dernière modif :{' '}
                  {dbLastUpdated})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDbSheet(false)}
                className="action-icon-btn"
                style={{ width: '34px', height: '34px' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1 : Tarifs Transport dans la Base de Données */}
            <div
              className="p-3.5 rounded-2xl mb-4 space-y-2.5"
              style={{
                background: 'var(--clay-soft)',
                border: '1px solid #FCD34D',
              }}
            >
              <div
                style={{
                  fontFamily: 'Archivo, sans-serif',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: 'var(--ink)',
                }}
              >
                1. Tarifs Transport (Semi-remorque 24t & Groupage)
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div
                  className="p-2.5 rounded-xl"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      color: 'var(--stone)',
                      marginBottom: '4px',
                    }}
                  >
                    Camion complet ({capaciteCamion}t / {capaciteCamion} BB)
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={prixCamionStr}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleChangePrixCamion(e.target.value)}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontWeight: 700,
                        fontSize: '15px',
                        color: 'var(--ink)',
                        outline: 'none',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: '12px',
                        color: 'var(--stone)',
                      }}
                    >
                      € HT
                    </span>
                  </div>
                </div>

                <div
                  className="p-2.5 rounded-xl"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      color: 'var(--stone)',
                      marginBottom: '4px',
                    }}
                  >
                    Groupage (prix / tonne · Big Bag)
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={prixGroupageTonneStr}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleChangePrixGroupage(e.target.value)}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontWeight: 700,
                        fontSize: '15px',
                        color: 'var(--clay)',
                        outline: 'none',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'IBM Plex Mono, monospace',
                        fontSize: '12px',
                        color: 'var(--stone)',
                      }}
                    >
                      €/t
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2 : Liste éditable des pavés */}
            <div
              style={{
                fontFamily: 'Archivo, sans-serif',
                fontSize: '13.5px',
                fontWeight: 700,
                marginBottom: '8px',
              }}
            >
              2. Tarifs des Pavés à la tonne (€/t)
            </div>
            <div className="space-y-2 mb-4">
              {paveDb.map((item) => {
                const isCustom = item.id.startsWith('custom-');
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl flex items-center justify-between gap-2"
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-semibold text-xs truncate"
                        style={{ color: 'var(--ink)' }}
                      >
                        {item.name}
                      </div>
                      <div
                        className="flex items-center gap-2 mt-1"
                        style={{ fontSize: '11px', color: 'var(--stone)' }}
                      >
                        <span>1 Big Bag (1t) =</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          value={item.m2Tonne}
                          onChange={(e) =>
                            handleUpdateDbItemM2(item.id, e.target.value)
                          }
                          style={{
                            width: '52px',
                            padding: '2px 5px',
                            borderRadius: '6px',
                            border: '1px solid var(--line)',
                            background: 'var(--surface)',
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontWeight: 600,
                            fontSize: '11.5px',
                            textAlign: 'center',
                          }}
                        />
                        <span>m²</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div
                        className="flex items-center px-2.5 py-1.5 rounded-xl"
                        style={{
                          background: 'var(--surface)',
                          border: '1.5px solid var(--line)',
                        }}
                      >
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.50"
                          value={item.prixTonne}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) =>
                            handleUpdateDbItemPrice(item.id, e.target.value)
                          }
                          style={{
                            width: '72px',
                            border: 'none',
                            background: 'transparent',
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontWeight: 700,
                            fontSize: '14px',
                            textAlign: 'right',
                            color: 'var(--accent)',
                            outline: 'none',
                          }}
                        />
                        <span
                          style={{
                            fontFamily: 'IBM Plex Mono, monospace',
                            fontSize: '11.5px',
                            color: 'var(--stone)',
                            marginLeft: '4px',
                          }}
                        >
                          €/t
                        </span>
                      </div>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteDbItem(item.id)}
                          className="action-icon-btn"
                          style={{
                            width: '32px',
                            height: '32px',
                            color: 'var(--clay)',
                          }}
                          title="Supprimer ce pavé"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Formulaire pour ajouter un nouveau pavé dans la base */}
            <form
              onSubmit={handleAddPaveToDb}
              className="p-3.5 rounded-2xl space-y-2.5 mb-3"
              style={{
                background: 'var(--bg)',
                border: '1.5px dashed var(--stone-soft)',
              }}
            >
              <div
                style={{
                  fontFamily: 'Archivo, sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                + Ajouter un nouveau pavé à la base
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <div className="input-row" style={{ padding: '2px 10px' }}>
                  <input
                    type="text"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13.5px',
                      fontWeight: 500,
                    }}
                    placeholder="Désignation (ex: Pavé granit GRIS 14X14X8 éclaté)"
                    value={newPaveName}
                    onChange={(e) => setNewPaveName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      color: 'var(--stone)',
                      marginBottom: '3px',
                    }}
                  >
                    Type / Surface par Big Bag
                  </label>
                  <select
                    className="pave-select"
                    value={newPaveFinition}
                    onChange={(e) => {
                      const fin = e.target.value as
                        | 'eclate'
                        | 'rectifie'
                        | 'autre';
                      setNewPaveFinition(fin);
                      if (fin === 'eclate') setNewPaveM2('9.5');
                      if (fin === 'rectifie') setNewPaveM2('10');
                    }}
                  >
                    <option value="eclate">Éclaté (9,5 m² / 1000kg)</option>
                    <option value="rectifie">Rectifié (10 m² / 1000kg)</option>
                    <option value="autre">Autre épaisseur (m²/t libre)</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      color: 'var(--stone)',
                      marginBottom: '3px',
                    }}
                  >
                    Prix HT à la tonne (€/t)
                  </label>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <div className="input-row" style={{ padding: '1px 10px' }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.50"
                        placeholder="Ex: 95.00"
                        style={{ fontSize: '14px', padding: '6px 0' }}
                        value={newPavePrix}
                        onChange={(e) => setNewPavePrix(e.target.value)}
                      />
                      <span className="unit" style={{ margin: 0 }}>
                        €/t
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {newPaveFinition === 'autre' && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Surface couverte par Big Bag de 1000 kg (m²/t)</label>
                  <div className="input-row" style={{ padding: '1px 10px' }}>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={newPaveM2}
                      onChange={(e) => setNewPaveM2(e.target.value)}
                      style={{ fontSize: '14px', padding: '6px 0' }}
                    />
                    <span className="unit">m²/t</span>
                  </div>
                </div>
              )}

              <button type="submit" className="bottom-btn primary w-full">
                <Plus className="w-4 h-4" />
                <span>Ajouter ce pavé dans la base</span>
              </button>
            </form>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleResetDatabase}
                className="text-xs font-medium inline-flex items-center gap-1 bg-transparent border-none cursor-pointer"
                style={{ color: 'var(--stone)' }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurer tous les tarifs d’origine</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDbSheet(false)}
                className="bottom-btn"
                style={{ height: '38px', fontSize: '12.5px' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet for Saved Quotes */}
      {showQuotesSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center no-print"
          style={{
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowQuotesSheet(false)}
        >
          <div
            className="w-full max-w-[500px] rounded-t-3xl p-5 max-h-[82dvh] overflow-y-auto"
            style={{
              background: 'var(--surface)',
              borderTop: '1px solid var(--line)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-10 h-1.5 rounded-full mx-auto mb-4"
              style={{ background: 'var(--stone-soft)' }}
            />
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3
                  style={{
                    fontFamily: 'Archivo, sans-serif',
                    fontSize: '17px',
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  Devis enregistrés ({savedQuotes.length})
                </h3>
                <div
                  className="inline-flex items-center gap-1.5 mt-1"
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: cloudConnected ? 'var(--accent)' : 'var(--stone)',
                  }}
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>
                    {cloudConnected
                      ? 'Base de données Cloud synchronisée (PC, Mobile & Netlify)'
                      : 'Synchronisation Cloud en cours…'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuotesSheet(false)}
                className="action-icon-btn"
                style={{ width: '34px', height: '34px' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuote} className="space-y-2.5 mb-4">
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Nom du chantier / client</label>
                <div className="input-row" style={{ padding: '2px 12px' }}>
                  <input
                    type="text"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      fontWeight: 500,
                    }}
                    placeholder="Ex: Chantier Melun — 351,5 m² (37 Big Bags)"
                    value={quoteTitle}
                    onChange={(e) => setQuoteTitle(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="bottom-btn primary w-full">
                {savedToast ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Devis sauvegardé !</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" />
                    <span>
                      Enregistrer le calcul actuel ({fmt(venteM2)} €/m²)
                    </span>
                  </>
                )}
              </button>
            </form>

            <div className="space-y-2">
              {savedQuotes.map((q) => {
                const qTotalM2 = (q.qte1 || 0) + (q.qte2 || 0);
                const qBags1 =
                  q.qte1 > 0 && q.m2Tonne
                    ? Math.ceil(q.qte1 / q.m2Tonne - 0.0001)
                    : 0;
                const qBags2 =
                  q.qte2 > 0 && q.m2Tonne
                    ? Math.ceil(q.qte2 / q.m2Tonne - 0.0001)
                    : 0;
                const qTotalBags = qBags1 + qBags2;
                const qStrictFull = Math.floor(qTotalBags / capaciteCamion);
                const qStrictRem = qTotalBags - qStrictFull * capaciteCamion;
                const qPrixCamion = q.prixCamionComplet24t ?? 2050;
                const qPrixGroup = q.prixGroupageTonne ?? 150;
                const qFullTrucks =
                  typeof q.nbCamionsManuel === 'number'
                    ? q.nbCamionsManuel
                    : qStrictRem * qPrixGroup > qPrixCamion
                    ? qStrictFull + 1
                    : qStrictFull;
                const qDeltaBags =
                  typeof q.nbGroupageBagsManuel === 'number'
                    ? q.nbGroupageBagsManuel
                    : qStrictRem * qPrixGroup > qPrixCamion
                    ? 0
                    : qStrictRem;

                const qGranit1 = q.m2Tonne
                  ? (q.prixTonne1 / q.m2Tonne) * (q.qte1 || 0)
                  : 0;
                const qGranit2 = q.m2Tonne
                  ? ((q.prixTonne2 || 0) / q.m2Tonne) * (q.qte2 || 0)
                  : 0;
                const qExtraTrans = (q.extraTransportLines || []).reduce(
                  (s, l) => s + (l.amount || 0),
                  0
                );
                const qTrans =
                  qFullTrucks * qPrixCamion +
                  qDeltaBags * qPrixGroup +
                  qExtraTrans;
                const qRevient = qGranit1 + qGranit2 + qTrans;
                const qVenteTotal = qRevient * q.coef;
                const qVenteM2 = qTotalM2 ? qVenteTotal / qTotalM2 : 0;

                return (
                  <div
                    key={q.id}
                    className="p-3 rounded-2xl flex items-center justify-between gap-3"
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadQuote(q)}
                      className="text-left flex-1 min-w-0 bg-transparent border-none p-0 cursor-pointer"
                      style={{ color: 'var(--ink)' }}
                    >
                      <div className="font-semibold text-sm truncate">
                        {q.title}
                      </div>
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--stone)',
                          marginTop: '2px',
                        }}
                      >
                        {fmt(qTotalM2)} m² ({qTotalBags} BB : {qFullTrucks}×camion
                        + {qDeltaBags}t groupage) · Coef{' '}
                        {q.coef.toFixed(2).replace('.', ',')}×
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className="text-right"
                        style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                      >
                        <div
                          style={{
                            fontSize: '13.5px',
                            fontWeight: 600,
                            color: 'var(--accent)',
                          }}
                        >
                          {fmt(qVenteM2)} €/m²
                        </div>
                        <div
                          style={{ fontSize: '11px', color: 'var(--stone)' }}
                        >
                          {fmt(qVenteTotal)} € HT
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuote(q.id)}
                        className="action-icon-btn"
                        style={{
                          width: '34px',
                          height: '34px',
                          color: 'var(--clay)',
                        }}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Onglet / Tiroir Partager : Descriptif Client en TTC signé L'équipe Elaxam */}
      {showShareSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center no-print"
          style={{
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowShareSheet(false)}
        >
          <div
            className="w-full max-w-[500px] rounded-t-3xl p-5 max-h-[86dvh] overflow-y-auto"
            style={{
              background: 'var(--surface)',
              borderTop: '1px solid var(--line)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-10 h-1.5 rounded-full mx-auto mb-4"
              style={{ background: 'var(--stone-soft)' }}
            />
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3
                  style={{
                    fontFamily: 'Archivo, sans-serif',
                    fontSize: '17px',
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  Partager au client (Proposition TTC)
                </h3>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--stone)',
                    margin: '2px 0 0',
                  }}
                >
                  Message prêt à envoyer sans détail de calcul interne — signé
                  L&apos;équipe Elaxam
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareSheet(false)}
                className="action-icon-btn"
                style={{ width: '34px', height: '34px' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Résumé rapide TTC en haut du tiroir */}
            <div
              className="p-3 rounded-2xl mb-3 flex items-center justify-between"
              style={{
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent)',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--accent)',
                  }}
                >
                  Prix de vente au m² TTC
                </div>
                <div
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: '17px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                  }}
                >
                  {fmt(venteM2TTC)} €/m² TTC
                </div>
              </div>
              <div className="text-right">
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--accent)',
                  }}
                >
                  Total TTC ({fmtCompact(numQteTotal)} m²)
                </div>
                <div
                  style={{
                    fontFamily: 'IBM Plex Mono, monospace',
                    fontSize: '17px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                  }}
                >
                  {fmt(venteTotalTTC)} € TTC
                </div>
              </div>
            </div>

            {/* Aperçu du texte client */}
            <div
              className="p-3.5 rounded-2xl mb-4"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--ink)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {clientShareText}
            </div>

            {/* Boutons d'action : Copier ou Envoyer via le menu de partage du téléphone */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyClientText}
                className="bottom-btn"
                style={{ height: '46px' }}
              >
                {copiedToast ? (
                  <>
                    <Check
                      className="w-4 h-4"
                      style={{ color: 'var(--accent)' }}
                    />
                    <span>Texte copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copier le texte</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleNativeShareClientText}
                className="bottom-btn primary"
                style={{ height: '46px' }}
              >
                <Share2 className="w-4 h-4" />
                <span>Envoyer (SMS / Mail)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ergonomic Mobile Bottom Action Bar (Thumb Zone) */}
      <div className="mobile-bottom-bar no-print">
        <div className="mobile-bottom-inner">
          <button
            type="button"
            onClick={() => {
              setShowShareSheet(true);
              handleCopyClientText();
            }}
            className="bottom-btn primary"
          >
            {copiedToast ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copié !</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Partager</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowDbSheet(true)}
            className="bottom-btn"
          >
            <Database className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span>Tarifs</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQuotesSheet(true)}
            className="bottom-btn"
          >
            <Bookmark className="w-4 h-4" style={{ color: 'var(--clay)' }} />
            <span>Devis ({savedQuotes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="bottom-btn"
            aria-label="Imprimer"
            title="Imprimer la fiche récapitulative 1 page A4"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>
      </div>

      {/* ==========================================================================
          FICHE RÉCAPITULATIVE D'IMPRESSION — DOSSIER PAPIER (1 SEULE PAGE A4)
          Affichée uniquement lors de l'impression (window.print / PDF)
          ========================================================================== */}
      <div className="print-only print-dossier">
        {/* En-tête de la fiche dossier papier */}
        <div className="pd-header">
          <div>
            <div className="pd-brand">
              ELAXAM — FICHE DE CALCUL INTERNE (PAVÉ GRANIT + TRANSPORT)
            </div>
            <div className="pd-sub">
              Récapitulatif complet de chiffrage pour dossier papier · Tél : 07
              444 11 666 · accueil.home@gmail.com
            </div>
          </div>
          <div className="pd-meta">
            <div>
              <strong>Date :</strong> {new Date().toLocaleDateString('fr-FR')}
            </div>
            <div>
              <strong>Dossier / Réf :</strong>{' '}
              {quoteTitle.trim() ? `${quoteTitle.trim()} (${clientRef})` : clientRef}
            </div>
          </div>
        </div>

        {/* 1. Bandeau Synthèse Générale (4 blocs clés : Vente HT, Vente TTC, Revient HT, Marge HT) */}
        <div className="pd-kpi-grid">
          <div className="pd-kpi-box">
            <div className="pd-kpi-label">PRIX DE VENTE HT (MOYEN)</div>
            <div className="pd-kpi-main">{fmt(venteM2)} €/m² HT</div>
            <div className="pd-kpi-sub">Total HT : {fmt(venteTotal)} € HT</div>
          </div>

          <div className="pd-kpi-box pd-kpi-highlight">
            <div className="pd-kpi-label">PRIX CLIENT TTC (TVA 20 %)</div>
            <div className="pd-kpi-main">{fmt(venteM2TTC)} €/m² TTC</div>
            <div className="pd-kpi-sub">
              Total TTC : <strong>{fmt(venteTotalTTC)} € TTC</strong>
            </div>
          </div>

          <div className="pd-kpi-box">
            <div className="pd-kpi-label">COÛT DE REVIENT TOTAL HT</div>
            <div className="pd-kpi-main">{fmt(coutRevientTotal)} € HT</div>
            <div className="pd-kpi-sub">
              Soit {fmt(coutRevientM2)} €/m² HT ({fmtCompact(numQteTotal)} m²)
            </div>
          </div>

          <div className="pd-kpi-box">
            <div className="pd-kpi-label">
              MARGE BRUTE HT (COEF {numCoef.toFixed(2).replace('.', ',')}×)
            </div>
            <div className="pd-kpi-main">+{fmt(margeTotal)} € HT</div>
            <div className="pd-kpi-sub">
              +{Math.round((numCoef - 1) * 100)} % sur coût de revient (+
              {fmt(numQteTotal ? margeTotal / numQteTotal : 0)} €/m²)
            </div>
          </div>
        </div>

        {/* 2. Détail Matière Première (Pavés Granit & Conditionnement en Big Bags de 1 000 kg) */}
        <div className="pd-section">
          <div className="pd-section-title">
            <span>
              1. DÉTAIL MATIÈRE PREMIÈRE (PAVÉS GRANIT &amp; CONDITIONNEMENT BIG
              BAGS 1 000 KG)
            </span>
            <span>
              Conditionnement retenu : 1 Big Bag (1 000 kg = 1 t) ={' '}
              {numM2t.toString().replace('.', ',')} m²
            </span>
          </div>
          <table className="pd-table">
            <thead>
              <tr>
                <th>Ligne / Désignation du pavé</th>
                <th>Surface</th>
                <th>Tonnage théorique</th>
                <th>Big Bags (1 000 kg)</th>
                <th>Achat €/t HT</th>
                <th>Achat €/m² HT</th>
                <th>Coût Granit HT</th>
                <th>Vente €/m² HT</th>
                <th>Vente €/m² TTC</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>1. Principal :</strong> {labelPave1}
                </td>
                <td>{fmt(numQte1)} m²</td>
                <td>{fmt(bigBagsExact1)} t</td>
                <td>
                  <strong>
                    {wholeBags1} BB ({wholeBags1} t)
                  </strong>
                </td>
                <td>{fmt(numPrixTonne1)} €/t</td>
                <td>{fmt(prixGranit1M2)} €/m²</td>
                <td>
                  <strong>{fmt(coutGranit1)} €</strong>
                </td>
                <td>{fmt(venteM2Ligne1)} € HT</td>
                <td>
                  <strong>{fmt(venteM2Ligne1TTC)} € TTC</strong>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>2. Décor / 2e :</strong>{' '}
                  {numQte2 > 0 ? labelPave2 : 'Aucun second pavé'}
                </td>
                <td>{fmt(numQte2)} m²</td>
                <td>{numQte2 > 0 ? `${fmt(bigBagsExact2)} t` : '–'}</td>
                <td>
                  <strong>
                    {wholeBags2} BB ({wholeBags2} t)
                  </strong>
                </td>
                <td>{numQte2 > 0 ? `${fmt(numPrixTonne2)} €/t` : '–'}</td>
                <td>{numQte2 > 0 ? `${fmt(prixGranit2M2)} €/m²` : '–'}</td>
                <td>
                  <strong>{fmt(coutGranit2)} €</strong>
                </td>
                <td>{numQte2 > 0 ? `${fmt(venteM2Ligne2)} € HT` : '–'}</td>
                <td>
                  <strong>
                    {numQte2 > 0 ? `${fmt(venteM2Ligne2TTC)} € TTC` : '–'}
                  </strong>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL MATIÈRE PREMIÈRE</td>
                <td>{fmt(numQteTotal)} m²</td>
                <td>{fmt(bigBagsExactTotal)} t</td>
                <td>
                  {totalWholeBagsToShip} Big Bags ({totalWholeBagsToShip} t)
                </td>
                <td>–</td>
                <td>
                  {fmt(numQteTotal ? coutGranit / numQteTotal : 0)} €/m²
                </td>
                <td>{fmt(coutGranit)} € HT</td>
                <td>{fmt(venteM2)} € HT</td>
                <td>{fmt(venteM2TTC)} € TTC</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 3. Détail du Calcul Transport (Répartition Camion complet 24t + Delta Groupage) */}
        <div className="pd-section">
          <div className="pd-section-title">
            <span>
              2. DÉTAIL DU CALCUL TRANSPORT (RÉPARTITION SEMI-REMORQUE{' '}
              {capaciteCamion}T + GROUPAGE)
            </span>
            <span>
              Total à expédier : {totalWholeBagsToShip} Big Bags (
              {totalWholeBagsToShip} tonnes)
            </span>
          </div>
          <table className="pd-table">
            <thead>
              <tr>
                <th>Mode de transport</th>
                <th>Détail du calcul (Big Bags / Tonnage)</th>
                <th>Tarif unitaire HT</th>
                <th>Incidence / m² HT</th>
                <th>Montant HT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>
                    Camion complet ({capaciteCamion} tonnes / {capaciteCamion}{' '}
                    Big Bags max)
                  </strong>
                </td>
                <td>
                  {nbCamionsComplets} camion{nbCamionsComplets > 1 ? 's' : ''}{' '}
                  complet{nbCamionsComplets > 1 ? 's' : ''} ({bagsInFullTrucks}{' '}
                  Big Bags = {bagsInFullTrucks} t)
                </td>
                <td>{fmt(numPrixCamionComplet)} € HT / camion</td>
                <td>
                  {fmt(numQteTotal ? coutCamionsComplets / numQteTotal : 0)}{' '}
                  €/m²
                </td>
                <td>
                  <strong>{fmt(coutCamionsComplets)} € HT</strong>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>
                    Transport Groupage (delta au-delà de {capaciteCamion}t)
                  </strong>
                </td>
                <td>
                  {deltaBagsGroupage} Big Bag{deltaBagsGroupage > 1 ? 's' : ''}{' '}
                  en groupage ({deltaBagsGroupage} t ×{' '}
                  {fmt(numPrixGroupageTonne)} €/t)
                </td>
                <td>{fmt(numPrixGroupageTonne)} € HT / tonne</td>
                <td>
                  {fmt(numQteTotal ? coutGroupageDelta / numQteTotal : 0)} €/m²
                </td>
                <td>
                  <strong>{fmt(coutGroupageDelta)} € HT</strong>
                </td>
              </tr>
              {extraTlines
                .filter((l) => l.amount > 0 || l.label.trim() !== '')
                .map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>Ligne complémentaire :</strong> {l.label}
                    </td>
                    <td>Forfait additionnel</td>
                    <td>{fmt(l.amount)} € HT</td>
                    <td>
                      {fmt(numQteTotal ? l.amount / numQteTotal : 0)} €/m²
                    </td>
                    <td>
                      <strong>{fmt(l.amount)} € HT</strong>
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL TRANSPORT HT</td>
                <td>
                  {nbCamionsComplets} camion(s) {capaciteCamion}t +{' '}
                  {deltaBagsGroupage} BB groupage = {totalWholeBagsToShip} BB (
                  {totalWholeBagsToShip} t)
                </td>
                <td>–</td>
                <td>{fmt(coutTransportM2)} €/m² HT</td>
                <td>{fmt(coutTransport)} € HT</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 4. Deux colonnes côte à côte : Chaîne complète de calcul du prix + Tableau comparatif des coefficients */}
        <div className="pd-two-cols">
          {/* Colonne gauche : Décomposition étape par étape */}
          <div className="pd-section" style={{ marginBottom: 0 }}>
            <div className="pd-section-title">
              <span>3. COMMENT ON EST ARRIVÉ AU PRIX DU DEVIS</span>
              <span>Étape par étape</span>
            </div>
            <table className="pd-table pd-step-table">
              <thead>
                <tr>
                  <th>Étape de calcul</th>
                  <th>Au m²</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1. Coût d&apos;achat Granit HT</td>
                  <td>
                    {fmt(numQteTotal ? coutGranit / numQteTotal : 0)} €/m²
                  </td>
                  <td>{fmt(coutGranit)} € HT</td>
                </tr>
                <tr>
                  <td>2. + Coût du Transport HT</td>
                  <td>+{fmt(coutTransportM2)} €/m²</td>
                  <td>+{fmt(coutTransport)} € HT</td>
                </tr>
                <tr className="pd-row-subtotal">
                  <td>
                    <strong>3. = COÛT DE REVIENT TOTAL HT (1 + 2)</strong>
                  </td>
                  <td>
                    <strong>{fmt(coutRevientM2)} €/m²</strong>
                  </td>
                  <td>
                    <strong>{fmt(coutRevientTotal)} € HT</strong>
                  </td>
                </tr>
                <tr>
                  <td>
                    4. × Coefficient de marge (
                    <strong>{numCoef.toFixed(2).replace('.', ',')}×</strong> soit
                    +{Math.round((numCoef - 1) * 100)} %)
                  </td>
                  <td>
                    +{fmt(numQteTotal ? margeTotal / numQteTotal : 0)} €/m²
                  </td>
                  <td>+{fmt(margeTotal)} € HT</td>
                </tr>
                <tr className="pd-row-subtotal">
                  <td>
                    <strong>5. = PRIX DE VENTE TOTAL HT (3 × Coef)</strong>
                  </td>
                  <td>
                    <strong>{fmt(venteM2)} €/m² HT</strong>
                  </td>
                  <td>
                    <strong>{fmt(venteTotal)} € HT</strong>
                  </td>
                </tr>
                <tr>
                  <td>6. + TVA (20 %)</td>
                  <td>+{fmt(venteM2TTC - venteM2)} €/m²</td>
                  <td>+{fmt(venteTotalTTC - venteTotal)} €</td>
                </tr>
                <tr className="pd-row-final">
                  <td>
                    <strong>7. = PRIX DE VENTE CLIENT TTC</strong>
                  </td>
                  <td>
                    <strong>{fmt(venteM2TTC)} €/m² TTC</strong>
                  </td>
                  <td>
                    <strong>{fmt(venteTotalTTC)} € TTC</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Colonne droite : Comparatif des coefficients de marge */}
          <div className="pd-section" style={{ marginBottom: 0 }}>
            <div className="pd-section-title">
              <span>4. BARÈME DES COEFFICIENTS DE MARGE</span>
              <span>Actif : {numCoef.toFixed(2).replace('.', ',')}×</span>
            </div>
            <table className="pd-table">
              <thead>
                <tr>
                  <th>Coef.</th>
                  <th>€/m² HT</th>
                  <th>€/m² TTC</th>
                  <th>Total HT</th>
                  <th>Total TTC</th>
                  <th>Marge HT</th>
                </tr>
              </thead>
              <tbody>
                {COEFS.map((c) => {
                  const totHT = coutRevientTotal * c;
                  const m2HT = numQteTotal ? totHT / numQteTotal : 0;
                  const totTTC = totHT * TVA_MULTIPLIER;
                  const m2TTC = m2HT * TVA_MULTIPLIER;
                  const marge = totHT - coutRevientTotal;
                  const isCurrent = Math.abs(c - numCoef) < 0.001;
                  return (
                    <tr
                      key={c}
                      className={isCurrent ? 'pd-coef-active' : undefined}
                    >
                      <td>
                        <strong>
                          {c.toFixed(2).replace('.', ',')}×
                          {isCurrent ? ' ✓' : ''}
                        </strong>
                      </td>
                      <td>{fmt(m2HT)} €</td>
                      <td>{fmt(m2TTC)} €</td>
                      <td>{fmt(totHT)} €</td>
                      <td>{fmt(totTTC)} €</td>
                      <td>+{fmt(marge)} €</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Pied de fiche : Conditions client rappelées & Zone de notes manuscrites pour le dossier papier */}
        <div className="pd-footer-box">
          <div className="pd-footer-col">
            <div className="pd-footer-title">
              CONDITIONS ANNONCÉES AU CLIENT (PROPOSITION TTC)
            </div>
            <div className="pd-footer-text">
              Prix global TTC de <strong>{fmt(venteTotalTTC)} € TTC</strong> (soit{' '}
              <strong>{fmt(venteM2TTC)} €/m² TTC</strong> pour{' '}
              <strong>{fmtCompact(numQteTotal)} m²</strong> /{' '}
              {totalWholeBagsToShip} Big Bags de 1 000 kg) incluant la matière
              première (pavé granit) et le transport livré à l&apos;adresse du
              client, sous réserve des accès poids lourd. Le client doit prévoir
              un engin de déchargement adapté pour décharger les Big Bags du
              camion.
            </div>
          </div>
          <div className="pd-footer-col pd-notes-zone">
            <div className="pd-footer-title">
              NOTES / OBSERVATIONS DOSSIER PAPIER
            </div>
            <div className="pd-note-line"></div>
            <div className="pd-note-line"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
