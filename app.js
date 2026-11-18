(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const els = {
    todayDate: $("today-date"),
    season: $("liturgical-season"),
    celebration: $("liturgical-celebration"),
    saint: $("saint-of-day"),
    useToday: $("use-today-theme"),
    customTheme: $("custom-theme"),
    presetTheme: $("preset-theme"),
    prayerType: $("prayer-type"),
    useLiturgicalTheme: $("use-liturgical-theme"),
    generate: $("generate-prayer"),
    variation: $("new-variation"),
    resetPrayerConfig: $("reset-prayer-config"),
    prayerText: $("prayer-text"),
    prayerThemeLabel: $("prayer-theme-label"),
    lineCount: $("line-count"),
    copy: $("copy-prayer"),
    fetchExternal: $("fetch-external"),
    fetchAnnouncements: $("fetch-announcements"),
    fetchAll: $("fetch-all"),
    externalStatus: $("external-status"),
    externalResult: $("external-result"),
    externalOriginal: $("external-original"),
    externalTranslation: $("external-translation"),
    announcementsResult: $("announcements-result"),
    announcementsTitle: $("announcements-title"),
    announcementsMeta: $("announcements-meta"),
    announcementsContent: $("announcements-content"),
    commonPrayerSelect: $("common-prayer-select"),
    commonPrayerName: $("common-prayer-name"),
    commonPrayerText: $("common-prayer-text"),
  };

  const state = {
    selectedTheme: "",
    variation: 0,
  };

  // --- Date / liturgical helpers ---
  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return startOfDay(x);
  }
  function diffDays(a, b) {
    const ms = startOfDay(a) - startOfDay(b);
    return Math.round(ms / 86400000);
  }
  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function formatLongDate(d) {
    return d.toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function keyMD(m, d) { return pad2(m) + "-" + pad2(d); }

  // Gregorian Easter (Meeus/Jones/Butcher)
  function easterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March,4=April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  function adventStart(year) {
    // 4th Sunday before Christmas (Sunday between Nov 27 and Dec 3 inclusive)
    const christmas = new Date(year, 11, 25);
    const dow = christmas.getDay(); // 0 Sun
    const daysToSundayBefore = dow === 0 ? 7 : dow;
    const fourthSunday = addDays(christmas, -(daysToSundayBefore + 21));
    return fourthSunday;
  }

  function baptismOfLord(year) {
    // Sunday after Jan 6 (Epiphany) in common calendar usage; if Epiphany is Sunday, next day Mon? Simplify: Sunday after Jan 6
    const epiphany = new Date(year, 0, 6);
    const dow = epiphany.getDay();
    const days = dow === 0 ? 7 : (7 - dow);
    return addDays(epiphany, days);
  }

  function liturgicalSeason(date) {
    const y = date.getFullYear();
    const d = startOfDay(date);
    const easter = easterSunday(y);
    const ash = addDays(easter, -46);
    const palm = addDays(easter, -7);
    const holyThu = addDays(easter, -3);
    const goodFri = addDays(easter, -2);
    const holySat = addDays(easter, -1);
    const pentecost = addDays(easter, 49);
    const advent = adventStart(y);
    const christmasStart = new Date(y, 11, 25);
    const baptism = baptismOfLord(y + (d >= christmasStart ? 1 : 0));
    // Christmas season spans year boundary
    const christmasSeasonStartThis = new Date(y, 11, 25);
    const christmasSeasonEndThis = baptismOfLord(y + 1);
    const christmasSeasonEndPrev = baptismOfLord(y);

    if (d >= advent && d < christmasSeasonStartThis) return { name: "Temps de l’Avent", detail: "Préparation à la venue du Seigneur" };
    if ((d >= christmasSeasonStartThis && d <= christmasSeasonEndThis) || (d <= christmasSeasonEndPrev && d >= new Date(y, 0, 1))) {
      return { name: "Temps de Noël", detail: "Joie de la naissance du Sauveur" };
    }
    if (sameDay(d, ash) || (d > ash && d < easter)) return { name: "Temps du Carême", detail: "Conversion, prière et partage" };
    if (d >= easter && d <= pentecost) return { name: "Temps pascal", detail: "Joie de la Résurrection" };
    if (d > pentecost) {
      const weeks = Math.floor(diffDays(d, pentecost) / 7) + 1;
      return { name: "Temps ordinaire", detail: "Semaine " + weeks + " après la Pentecôte" };
    }
    // before Ash Wednesday (after Baptism)
    const weeks = Math.max(1, Math.floor(diffDays(d, christmasSeasonEndPrev) / 7) + 1);
    return { name: "Temps ordinaire", detail: "Croissance dans la foi au quotidien" };
  }

  function movableFeasts(year) {
    const easter = easterSunday(year);
    const pentecost = addDays(easter, 49);
    const trinity = addDays(pentecost, 7);
    const corpus = addDays(trinity, 4); // Thursday after Trinity (common)
    const sacredHeart = addDays(corpus, 8);
    const christKing = addDays(adventStart(year), -7);
    const holyFamily = (() => {
      const d = new Date(year, 11, 30);
      while (d.getDay() !== 0) d.setDate(d.getDate() - 1); // Sunday in octave or Dec 30
      if (d.getDate() === 25) return new Date(year, 11, 30);
      return d;
    })();
    const map = {};
    map[keyMD(easter.getMonth() + 1, easter.getDate())] = "Dimanche de Pâques — Résurrection du Seigneur";
    map[keyMD(pentecost.getMonth() + 1, pentecost.getDate())] = "Pentecôte";
    map[keyMD(trinity.getMonth() + 1, trinity.getDate())] = "Sainte Trinité";
    map[keyMD(corpus.getMonth() + 1, corpus.getDate())] = "Saint-Sacrement du Corps et du Sang du Christ";
    map[keyMD(sacredHeart.getMonth() + 1, sacredHeart.getDate())] = "Sacré-Cœur de Jésus";
    map[keyMD(christKing.getMonth() + 1, christKing.getDate())] = "Christ Roi de l’univers";
    map[keyMD(holyFamily.getMonth() + 1, holyFamily.getDate())] = "Sainte Famille";
    map[keyMD(addDays(easter,-3).getMonth()+1, addDays(easter,-3).getDate())] = "Jeudi Saint";
    map[keyMD(addDays(easter,-2).getMonth()+1, addDays(easter,-2).getDate())] = "Vendredi Saint";
    return map;
  }

  const fixedFeasts = {
    "01-01": { feast: "Sainte Marie, Mère de Dieu", saint: "Sainte Marie" },
    "01-06": { feast: "Épiphanie du Seigneur", saint: "Manifestation du Seigneur" },
    "02-02": { feast: "Présentation du Seigneur", saint: "Jésus présenté au Temple" },
    "03-19": { feast: "Saint Joseph, époux de la Vierge Marie", saint: "Saint Joseph" },
    "03-25": { feast: "Annonciation du Seigneur", saint: "Annonciation" },
    "06-24": { feast: "Nativité de saint Jean-Baptiste", saint: "Saint Jean-Baptiste" },
    "06-29": { feast: "Saints Pierre et Paul, apôtres", saint: "Saint Pierre et saint Paul" },
    "08-15": { feast: "Assomption de la Vierge Marie", saint: "Vierge Marie" },
    "09-08": { feast: "Nativité de la Vierge Marie", saint: "Vierge Marie" },
    "11-01": { feast: "Toussaint", saint: "Tous les saints" },
    "11-02": { feast: "Commémoration des fidèles défunts", saint: "Fidèles défunts" },
    "12-08": { feast: "Immaculée Conception", saint: "Vierge Marie" },
    "12-25": { feast: "Nativité du Seigneur", saint: "Naissance de Jésus" },
  };

  const saintsByDay = {
    "01-01":"Sainte Marie, Mère de Dieu","01-02":"Saint Basile le Grand et saint Grégoire de Nazianze","01-03":"Sainte Geneviève","01-04":"Sainte Angèle de Foligno","01-05":"Saint Édouard le Confesseur","01-06":"Épiphanie du Seigneur","01-07":"Saint Raymond de Peñafort","01-13":"Saint Hilaire de Poitiers","01-17":"Saint Antoine le Grand","01-20":"Saint Sébastien","01-21":"Sainte Agnès","01-24":"Saint François de Sales","01-25":"Conversion de saint Paul","01-26":"Saints Timothée et Tite","01-28":"Saint Thomas d’Aquin","01-31":"Saint Jean Bosco",
    "02-02":"Présentation du Seigneur","02-03":"Saint Blaise","02-05":"Sainte Agathe","02-06":"Saint Paul Miki et ses compagnons","02-10":"Sainte Scholastique","02-11":"Notre-Dame de Lourdes","02-14":"Saints Cyrille et Méthode","02-22":"Chaire de saint Pierre",
    "03-17":"Saint Patrick","03-19":"Saint Joseph","03-25":"Annonciation du Seigneur",
    "04-02":"Saint François de Paule","04-04":"Saint Isidore de Séville","04-07":"Saint Jean-Baptiste de La Salle","04-11":"Saint Stanislas","04-21":"Saint Anselme","04-23":"Saint Georges","04-25":"Saint Marc","04-29":"Sainte Catherine de Sienne","04-30":"Saint Pie V",
    "05-01":"Saint Joseph artisan","05-02":"Saint Athanase","05-03":"Saints Philippe et Jacques","05-12":"Saints Nérée et Achillée","05-13":"Notre-Dame de Fatima","05-14":"Saint Matthias","05-26":"Saint Philippe Néri","05-31":"Visitation de la Vierge Marie",
    "06-01":"Saint Justin","06-02":"Saints Marcelin et Pierre","06-03":"Saints Charles Lwanga et ses compagnons","06-05":"Saint Boniface","06-09":"Saint Éphrem","06-11":"Saint Barnabé","06-13":"Saint Antoine de Padoue","06-21":"Saint Louis de Gonzague","06-24":"Nativité de saint Jean-Baptiste","06-29":"Saints Pierre et Paul",
    "07-03":"Saint Thomas","07-11":"Saint Benoît","07-14":"Saint Camille de Lellis","07-15":"Saint Bonaventure","07-16":"Notre-Dame du Mont-Carmel","07-22":"Sainte Marie-Madeleine","07-23":"Sainte Brigitte","07-25":"Saint Jacques","07-26":"Sainte Anne et saint Joachim","07-29":"Sainte Marthe","07-31":"Saint Ignace de Loyola",
    "08-04":"Saint Jean-Marie Vianney","08-06":"Transfiguration du Seigneur","08-08":"Saint Dominique","08-10":"Saint Laurent","08-11":"Sainte Claire","08-15":"Assomption de la Vierge Marie","08-20":"Saint Bernard","08-22":"Vierge Marie Reine","08-24":"Saint Barthélemy","08-27":"Sainte Monique","08-28":"Saint Augustin","08-29":"Martyre de saint Jean-Baptiste",
    "09-03":"Saint Grégoire le Grand","09-08":"Nativité de la Vierge Marie","09-13":"Saint Jean Chrysostome","09-14":"La Croix glorieuse","09-15":"Notre-Dame des Douleurs","09-16":"Saints Corneille et Cyprien","09-21":"Saint Matthieu","09-27":"Saint Vincent de Paul","09-29":"Saints Michel, Gabriel et Raphaël","09-30":"Saint Jérôme",
    "10-01":"Sainte Thérèse de l’Enfant-Jésus","10-02":"Saints Anges gardiens","10-04":"Saint François d’Assise","10-07":"Notre-Dame du Rosaire","10-15":"Sainte Thérèse d’Avila","10-17":"Saint Ignace d’Antioche","10-18":"Saint Luc","10-28":"Saints Simon et Jude",
    "11-01":"Toussaint","11-02":"Fidèles défunts","11-03":"Saint Martin de Porrès","11-04":"Saint Charles Borromée","11-09":"Dédicace de la basilique du Latran","11-10":"Saint Léon le Grand","11-11":"Saint Martin de Tours","11-15":"Saint Albert le Grand","11-17":"Sainte Élisabeth de Hongrie","11-21":"Présentation de la Vierge Marie","11-22":"Sainte Cécile","11-30":"Saint André",
    "12-03":"Saint François Xavier","12-06":"Saint Nicolas","12-07":"Saint Ambroise","12-08":"Immaculée Conception","12-12":"Notre-Dame de Guadalupe","12-13":"Sainte Lucie","12-14":"Saint Jean de la Croix","12-25":"Nativité du Seigneur","12-26":"Saint Étienne","12-27":"Saint Jean, apôtre","12-28":"Saints Innocents","12-31":"Saint Sylvestre Ier"
  };

  function getThemeOfDay(date) {
    const season = liturgicalSeason(date);
    const mov = movableFeasts(date.getFullYear());
    const k = keyMD(date.getMonth() + 1, date.getDate());
    const fixed = fixedFeasts[k];
    const celebration = mov[k] || (fixed && fixed.feast) || (season.name === "Temps ordinaire" ? "Mémoire du jour" : "Célébration du jour");
    const saint = (fixed && fixed.saint) || saintsByDay[k] || "Saint(e) du jour";
    const summary = [season.name, celebration, saint].filter(Boolean).join(" — ");
    return { season: season.name, seasonDetail: season.detail, celebration, saint, summary };
  }

  // --- Prayer generation ---
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  function prayerTypeLabel(type) {
    const map = {
      adoration: "Adoration",
      intercession: "Intercession",
      petition: "Pétition",
      gratitude: "Gratitude",
      glorification: "Glorification de Dieu",
    };
    return map[type] || "Prière";
  }

  function buildPrayer(themeText, dayInfo, date, variation, prayerType) {
    const type = prayerType || "petition";
    const seed = hashString(date.toDateString() + "|" + themeText + "|" + type + "|" + variation);
    const rng = mulberry32(seed);

    const templates = {
      adoration: {
        openings: ["Seigneur Dieu,", "Père très saint,", "Seigneur Jésus,", "Dieu éternel,"],
        lines2: [
          `je t’adore et je me tourne vers toi en pensant à ${themeText.toLowerCase()}.`,
          `en ce jour, je te rends gloire et je contemple ta présence dans ${themeText.toLowerCase()}.`,
        ],
        lines3: [
          "Tu es grand, digne de louange et plein d’amour,",
          "Mon cœur s’émerveille devant ta sainteté et ta bonté,",
        ],
        lines4: [
          `dans l’esprit de ${dayInfo.season.toLowerCase()} et en union avec ${dayInfo.celebration.toLowerCase()}.`,
          `avec l’intercession de ${dayInfo.saint}, je t’offre mon adoration.`,
        ],
        closings: ["À toi la gloire pour les siècles des siècles. Amen.", "Je t’adore aujourd’hui et toujours. Amen."],
      },
      intercession: {
        openings: ["Seigneur Dieu,", "Père miséricordieux,", "Seigneur Jésus,", "Dieu de compassion,"],
        lines2: [
          `je te prie pour ${themeText.toLowerCase()} et pour tous ceux qui en ont besoin.`,
          `aujourd’hui, j’intercède auprès de toi pour ${themeText.toLowerCase()}.`,
        ],
        lines3: [
          "Pose ton regard de tendresse sur les personnes que je te confie,",
          "Accorde secours, réconfort et espérance à chacun,",
        ],
        lines4: [
          `en union avec ${dayInfo.celebration.toLowerCase()} et dans l’esprit de ${dayInfo.season.toLowerCase()}.`,
          `avec l’intercession de ${dayInfo.saint}, écoute ma prière.`,
        ],
        closings: ["Seigneur, entends ma prière. Amen.", "Nous te le demandons avec confiance. Amen."],
      },
      petition: {
        openings: ["Seigneur Dieu,", "Père très aimant,", "Seigneur Jésus,", "Dieu de miséricorde,"],
        lines2: [
          `en ce jour, je te présente ${themeText.toLowerCase()}.`,
          `je viens à toi avec confiance pour te demander ${themeText.toLowerCase()}.`,
        ],
        lines3: [
          "Accorde-moi la paix, la force et la lumière dont j’ai besoin,",
          "Guide mes pas et soutiens-moi dans ce que je vis,",
        ],
        lines4: [
          `dans l’esprit de ${dayInfo.season.toLowerCase()} et en union avec ${dayInfo.celebration.toLowerCase()}.`,
          `avec l’intercession de ${dayInfo.saint}, viens à mon aide.`,
        ],
        closings: ["Que ta volonté s’accomplisse en moi. Amen.", "Je m’abandonne à toi avec confiance. Amen."],
      },
      gratitude: {
        openings: ["Seigneur Dieu,", "Père très aimant,", "Seigneur Jésus,", "Dieu de bonté,"],
        lines2: [
          `je te rends grâce aujourd’hui pour ${themeText.toLowerCase()}.`,
          `mon cœur te dit merci pour ${themeText.toLowerCase()} que tu me donnes.`,
        ],
        lines3: [
          "Merci pour ta présence fidèle et tes bienfaits dans ma vie,",
          "Apprends-moi à reconnaître tes dons avec joie et humilité,",
        ],
        lines4: [
          `en union avec ${dayInfo.celebration.toLowerCase()} et dans l’esprit de ${dayInfo.season.toLowerCase()}.`,
          `avec l’intercession de ${dayInfo.saint}, je te bénis pour tout.`,
        ],
        closings: ["Pour tout ce que tu fais, merci Seigneur. Amen.", "Je te rends grâce aujourd’hui et toujours. Amen."],
      },
      glorification: {
        openings: ["Seigneur Dieu,", "Père tout-puissant,", "Seigneur Jésus,", "Dieu vivant,"],
        lines2: [
          `je te glorifie et je célèbre ta grandeur à travers ${themeText.toLowerCase()}.`,
          `en ce jour, je proclame ta gloire en pensant à ${themeText.toLowerCase()}.`,
        ],
        lines3: [
          "Que ton nom soit béni, honoré et exalté en tout temps,",
          "Toute la création témoigne de ta puissance et de ton amour,",
        ],
        lines4: [
          `dans l’esprit de ${dayInfo.season.toLowerCase()} et en union avec ${dayInfo.celebration.toLowerCase()}.`,
          `avec l’intercession de ${dayInfo.saint}, je chante ta gloire.`,
        ],
        closings: ["Gloire à toi, Seigneur, maintenant et toujours. Amen.", "À toi l’honneur et la louange. Amen."],
      },
    };

    const t = templates[type] || templates.petition;
    const lines = [
      pick(rng, t.openings),
      pick(rng, t.lines2),
      pick(rng, t.lines3),
      pick(rng, t.lines4),
      pick(rng, t.closings),
    ];

    if (rng() > 0.45) {
      lines.splice(3, 0, pick(rng, [
        "Que ta lumière éclaire chacun de mes pas,",
        "Garde mon cœur ouvert à ta présence,",
        "Rends-moi disponible à ton appel,",
      ]));
    }
    if (rng() > 0.75) {
      lines.splice(lines.length - 1, 0, pick(rng, [
        "Bénis ceux que j’aime et ceux que je rencontre,",
        "Fais de moi un instrument de ta paix,",
      ]));
    }

    return lines.slice(0, 8).join("\n");
  }

  function currentThemeText(dayInfo) {
    const custom = els.customTheme.value.trim();
    const preset = els.presetTheme.value;
    if (custom) return custom;
    if (preset) return preset;
    if (els.useLiturgicalTheme && !els.useLiturgicalTheme.checked) {
      return "ma prière de ce jour";
    }
    return dayInfo.summary;
  }

  function renderPrayer() {
    const today = new Date();
    const dayInfo = getThemeOfDay(today);
    const themeText = state.selectedTheme || currentThemeText(dayInfo);
    const type = els.prayerType ? els.prayerType.value : "petition";
    const prayer = buildPrayer(themeText, dayInfo, today, state.variation, type);
    els.prayerThemeLabel.textContent = "Type : " + prayerTypeLabel(type) + " — Thème : " + themeText;
    els.prayerText.textContent = prayer;
    const count = prayer.split("\n").length;
    els.lineCount.textContent = count + (count > 1 ? " lignes" : " ligne");
  }

  function renderToday() {
    const today = new Date();
    const info = getThemeOfDay(today);
    els.todayDate.textContent = formatLongDate(today);
    els.season.textContent = info.season + (info.seasonDetail ? " — " + info.seasonDetail : "");
    els.celebration.textContent = info.celebration;
    els.saint.textContent = info.saint;
  }

  // --- External prayer (mysmhs.ca) ---
  const KNOWN_EXTERNAL = {
    original: [
      "The Church has given us the seven Catholic Social Teachings to show love for our neighbor, as we embrace social justice issues. These teachings, based on scripture and church teaching, remind us of the values that God wants us to embrace.",
      "",
      "Loving God,",
      "We believe that every person is created in Your image",
      "and that all life is sacred.",
      "May we always work to eliminate poverty and injustice,",
      "so all people can live a life equal to their dignity.",
      "Help us to see the dignity in all Your children.",
      "We ask this in the name of Jesus,",
      "Amen"
    ].join("\n"),
    translation: [
      "L’Église nous a donné les sept enseignements sociaux catholiques pour nous montrer comment aimer notre prochain, alors que nous nous engageons face aux enjeux de justice sociale. Fondés sur l’Écriture et sur l’enseignement de l’Église, ces enseignements nous rappellent les valeurs que Dieu veut que nous vivions.",
      "",
      "Dieu d’amour,",
      "nous croyons que chaque personne est créée à ton image",
      "et que toute vie est sacrée.",
      "Aide-nous à travailler sans cesse pour éliminer la pauvreté et l’injustice,",
      "afin que tous puissent vivre une vie digne de leur dignité.",
      "Aide-nous à reconnaître la dignité de tous tes enfants.",
      "Nous te le demandons au nom de Jésus.",
      "Amen"
    ].join("\n")
  };

  async function fetchWithFallback(url) {
    const attempts = [
      "https://r.jina.ai/http://www.mysmhs.ca/",
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
      "https://corsproxy.io/?url=" + encodeURIComponent(url),
      url
    ];
    let lastErr;
    for (const u of attempts) {
      try {
        const res = await fetch(u, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        return await res.text();
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("Échec de chargement");
  }

  function extractMorningPrayerFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const text = (doc.body && doc.body.innerText) ? doc.body.innerText : html.replace(/<[^>]+>/g, " ");
    const norm = text.replace(/\r/g, "");
    const idx = norm.toUpperCase().indexOf("MORNING PRAYER");
    if (idx === -1) return null;
    let after = norm.slice(idx + "MORNING PRAYER".length);
    // stop at next section heading commonly present
    const stops = ["SCHOOL SUPERVISION", "CAFETERIA", "PLAINS CREE", "ANNOUNCEMENTS", "DAY 1", "DAY 2", "DAY 3", "DAY 4", "DAY 5", "DAY 6"];
    let end = after.length;
    for (const s of stops) {
      const i = after.toUpperCase().indexOf(s);
      if (i !== -1 && i < end) end = i;
    }
    let block = after.slice(0, end).trim();
    // clean excessive blank lines, keep preamble and prayer together
    block = block.split("\n").map(l => l.trim()).filter((l, i, arr) => l !== "" || (arr[i-1] && arr[i-1] !== "")).join("\n").trim();
    // limit length reasonably
    if (block.length > 1600) block = block.slice(0, 1600).trim();
    return block || null;
  }

  async function translateToFrench(text) {
    // Try public translation API; fallback to known translation if text matches closely
    const clean = text.replace(/\s+/g, " ").trim();
    const knownClean = KNOWN_EXTERNAL.original.replace(/\s+/g, " ").trim();
    if (clean === knownClean || (clean.includes("seven Catholic Social Teachings") && clean.includes("every person is created in Your image"))) {
      return KNOWN_EXTERNAL.translation;
    }
    try {
      const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text.slice(0, 1200)) + "&langpair=en|fr";
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function extractLatestPostFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    // Try common Blogger structures: first post
    const post =
      doc.querySelector(".post-outer") ||
      doc.querySelector(".post") ||
      doc.querySelector("article") ||
      doc.querySelector(".date-outer");
    if (!post) return null;

    const titleEl = post.querySelector(".post-title a, .post-title, h3 a, h3, h2 a, h2");
    const dateEl = post.querySelector(".date-header span, .date-header, .published, time");
    const title = titleEl ? titleEl.textContent.trim() : "Publication la plus récente";
    const date = dateEl ? dateEl.textContent.trim() : "";

    // Prefer body content
    const body = post.querySelector(".post-body") || post;
    const clone = body.cloneNode(true);
    // remove scripts/styles/nav junk
    clone.querySelectorAll("script, style, noscript").forEach(n => n.remove());
    // Include cafeteria (meal of day/week) and announcements when possible
    let htmlOut = "";
    const upper = clone.innerHTML.toUpperCase();
    const cafeIdx = upper.indexOf("CAFETERIA");
    const annIdx = upper.indexOf("ANNOUNCEMENTS");
    if (cafeIdx !== -1) {
      htmlOut = clone.innerHTML.slice(cafeIdx);
    } else if (annIdx !== -1) {
      htmlOut = clone.innerHTML.slice(annIdx);
    } else {
      htmlOut = clone.innerHTML;
    }

    // basic cleanup: drop empty
    const temp = doc.createElement("div");
    temp.innerHTML = htmlOut;
    temp.querySelectorAll("img").forEach(img => {
      // keep images but ensure they don't overflow
      img.removeAttribute("width");
      img.removeAttribute("height");
      img.style.maxWidth = "100%";
      img.style.height = "auto";
    });
    // remove overly long leading whitespace text nodes
    htmlOut = temp.innerHTML.trim();
    if (!htmlOut || temp.textContent.trim().length < 20) return null;

    return { title, date, html: htmlOut };
  }

  async function loadExternalPrayer(opts = {}) {
    const silentStatus = !!opts.silentStatus;
    if (!silentStatus) {
      els.externalStatus.textContent = "Chargement de la prière depuis mysmhs.ca…";
      els.externalStatus.className = "hint";
    }
    els.externalResult.style.display = "none";
    els.fetchExternal.disabled = true;
    try {
      let html = window.__mysmhsHtml;
      if (!html) {
        html = await fetchWithFallback("http://www.mysmhs.ca/");
        window.__mysmhsHtml = html;
      }
      const prayer = extractMorningPrayerFromHtml(html);
      if (!prayer) throw new Error("Prière du matin introuvable sur la page.");
      els.externalOriginal.textContent = prayer;
      const translated = await translateToFrench(prayer);
      if (translated) {
        els.externalTranslation.textContent = translated;
        if (!silentStatus) {
          els.externalStatus.textContent = "Prière chargée et traduite en français.";
          els.externalStatus.className = "hint status-ok";
        }
      } else {
        els.externalTranslation.textContent = "Traduction automatique indisponible pour le moment. Voici la prière originale ci-dessus.";
        if (!silentStatus) {
          els.externalStatus.textContent = "Prière chargée (traduction automatique indisponible).";
          els.externalStatus.className = "hint";
        }
      }
      els.externalResult.style.display = "grid";
      return { ok: true };
    } catch (e) {
      els.externalOriginal.textContent = KNOWN_EXTERNAL.original;
      els.externalTranslation.textContent = KNOWN_EXTERNAL.translation;
      if (!silentStatus) {
        els.externalStatus.textContent = "Impossible de charger le site en direct (accès réseau/CORS). Affichage de la dernière prière récupérée et traduite.";
        els.externalStatus.className = "hint status-error";
      }
      els.externalResult.style.display = "grid";
      return { ok: false };
    } finally {
      els.fetchExternal.disabled = false;
    }
  }

  async function loadLatestAnnouncements(opts = {}) {
    const silentStatus = !!opts.silentStatus;
    if (!silentStatus) {
      els.externalStatus.textContent = "Chargement des annonces les plus récentes…";
      els.externalStatus.className = "hint";
    }
    els.announcementsResult.style.display = "none";
    els.fetchAnnouncements.disabled = true;
    try {
      let html = window.__mysmhsHtml;
      if (!html) {
        html = await fetchWithFallback("http://www.mysmhs.ca/");
        window.__mysmhsHtml = html;
      }
      const post = extractLatestPostFromHtml(html);
      if (!post) throw new Error("Annonces introuvables sur la page.");
      els.announcementsTitle.textContent = "Annonces et repas — " + post.title;
      els.announcementsMeta.textContent = post.date ? ("Publication : " + post.date) : "Publication la plus récente";
      els.announcementsContent.innerHTML = post.html;
      els.announcementsResult.style.display = "grid";
      if (!silentStatus) {
        els.externalStatus.textContent = "Annonces et repas les plus récents affichés ci-dessous (sans traduction).";
        els.externalStatus.className = "hint status-ok";
      }
      return { ok: true };
    } catch (e) {
      els.announcementsTitle.textContent = "Annonces et repas";
      els.announcementsMeta.textContent = "";
      els.announcementsContent.innerHTML = '<p>Impossible de charger les annonces en direct. Vous pouvez ouvrir le site pour les consulter.</p><p><a href="http://www.mysmhs.ca/" target="_blank" rel="noopener noreferrer">Ouvrir mysmhs.ca</a></p>';
      els.announcementsResult.style.display = "grid";
      if (!silentStatus) {
        els.externalStatus.textContent = "Impossible de charger les annonces en direct (accès réseau/CORS).";
        els.externalStatus.className = "hint status-error";
      }
      return { ok: false };
    } finally {
      els.fetchAnnouncements.disabled = false;
    }
  }

  async function loadAllExternal() {
    els.externalStatus.textContent = "Chargement de la prière et des annonces…";
    els.externalStatus.className = "hint";
    els.fetchAll.disabled = true;
    try {
      const [pRes, aRes] = await Promise.all([
        loadExternalPrayer({ silentStatus: true }),
        loadLatestAnnouncements({ silentStatus: true }),
      ]);
      const parts = [];
      parts.push(pRes && pRes.ok ? "prière chargée" : "prière en repli/indisponible");
      parts.push(aRes && aRes.ok ? "annonces chargées" : "annonces indisponibles");
      els.externalStatus.textContent = "Terminé : " + parts.join(", ") + ".";
      els.externalStatus.className = (pRes && pRes.ok) || (aRes && aRes.ok) ? "hint status-ok" : "hint status-error";
    } finally {
      els.fetchAll.disabled = false;
    }
  }

  // --- Tabs ---
  function initTabs() {
    const buttons = Array.from(document.querySelectorAll(".tab-button"));
    const panels = Array.from(document.querySelectorAll(".tab-panel"));
    function activate(name) {
      buttons.forEach(btn => {
        const active = btn.dataset.tab === name;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach(panel => {
        const active = panel.id === "panel-" + name;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
      });
    }
    buttons.forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.tab)));
  }

  // --- Common prayers ---
  const commonPrayers = [
    { id: "notre-pere", name: "Notre Père", text: "Notre Père, qui es aux cieux,\nque ton nom soit sanctifié,\nque ton règne vienne,\nque ta volonté soit faite sur la terre comme au ciel.\nDonne-nous aujourd’hui notre pain de ce jour.\nPardonne-nous nos offenses,\ncomme nous pardonnons aussi à ceux qui nous ont offensés.\nEt ne nous laisse pas entrer en tentation,\nmais délivre-nous du Mal.\nAmen." },
    { id: "je-vous-salue-marie", name: "Je vous salue Marie", text: "Je vous salue, Marie, pleine de grâce ;\nle Seigneur est avec vous.\nVous êtes bénie entre toutes les femmes,\net Jésus, le fruit de vos entrailles, est béni.\nSainte Marie, Mère de Dieu,\npriez pour nous, pauvres pécheurs,\nmaintenant et à l’heure de notre mort.\nAmen." },
    { id: "gloire-au-pere", name: "Gloire au Père", text: "Gloire au Père, et au Fils, et au Saint-Esprit,\ncomme il était au commencement,\nmaintenant et toujours,\net dans les siècles des siècles.\nAmen." },
    { id: "credo", name: "Symbole des Apôtres (Credo)", text: "Je crois en Dieu, le Père tout-puissant,\ncréateur du ciel et de la terre.\nEt en Jésus Christ, son Fils unique, notre Seigneur,\nqui a été conçu du Saint-Esprit,\nest né de la Vierge Marie,\na souffert sous Ponce Pilate,\na été crucifié, est mort et a été enseveli,\nest descendu aux enfers ;\nle troisième jour est ressuscité des morts,\nest monté aux cieux,\nest assis à la droite de Dieu le Père tout-puissant,\nd’où il viendra juger les vivants et les morts.\nJe crois en l’Esprit Saint,\nà la sainte Église catholique,\nà la communion des saints,\nà la rémission des péchés,\nà la résurrection de la chair,\nà la vie éternelle.\nAmen." },
    { id: "ange-gardien", name: "Prière à l’Ange gardien", text: "Ange de Dieu,\nqui es mon gardien,\net à qui j’ai été confié par la Bonté divine,\néclaire-moi, défends-moi,\nconduis-moi et dirige-moi.\nAmen." },
    { id: "acte-de-foi", name: "Acte de foi", text: "Mon Dieu, je crois fermement toutes les vérités\nque tu as révélées et que tu nous enseignes par ton Église,\nparce que tu ne peux ni te tromper ni nous tromper.\nAmen." },
    { id: "acte-desperance", name: "Acte d’espérance", text: "Mon Dieu, j’espère avec une ferme confiance\nque tu me donneras, par les mérites de Jésus-Christ,\nta grâce en ce monde et, si j’observe tes commandements,\nle bonheur éternel dans l’autre,\nparce que tu l’as promis et que tu es fidèle dans tes promesses.\nAmen." },
    { id: "acte-de-charite", name: "Acte de charité", text: "Mon Dieu, je t’aime de tout mon cœur et par-dessus toutes choses,\nparce que tu es infiniment bon et infiniment aimable ;\net j’aime mon prochain comme moi-même pour l’amour de toi.\nAmen." },
    { id: "je-confesse", name: "Je confesse à Dieu", text: "Je confesse à Dieu tout-puissant,\nje reconnais devant mes frères\nque j’ai péché en pensée, en parole,\npar action et par omission ;\noui, j’ai vraiment péché.\nC’est pourquoi je supplie\nla bienheureuse Vierge Marie,\nles anges et tous les saints,\net vous aussi, mes frères,\nde prier pour moi le Seigneur notre Dieu.\nAmen." },
    { id: "priere-du-matin", name: "Prière du matin", text: "Seigneur, au début de ce jour,\nje te rends grâce pour la vie que tu me donnes.\nGuide mes pas, éclaire mes pensées\net bénis tout ce que j’accomplirai aujourd’hui.\nQue tout soit pour ta gloire.\nAmen." },
    { id: "priere-du-soir", name: "Prière du soir", text: "Seigneur, à la fin de cette journée,\nje te remercie pour tous tes bienfaits.\nPardonne mes fautes,\nprotège ceux que j’aime\net accorde-moi un repos paisible sous ta garde.\nAmen." }
  ];

  function initCommonPrayers() {
    if (!els.commonPrayerSelect) return;
    els.commonPrayerSelect.innerHTML = commonPrayers
      .map(p => `<option value="${p.id}">${p.name}</option>`)
      .join("");
    function render() {
      const p = commonPrayers.find(x => x.id === els.commonPrayerSelect.value) || commonPrayers[0];
      if (!p) return;
      els.commonPrayerName.textContent = p.name;
      els.commonPrayerText.textContent = p.text;
    }
    els.commonPrayerSelect.addEventListener("change", render);
    render();
  }

  // --- Events ---
  initTabs();
  initCommonPrayers();
  els.useToday.addEventListener("click", () => {
    state.selectedTheme = "";
    state.variation = 0;
    els.customTheme.value = "";
    els.presetTheme.value = "";
    if (els.prayerType) els.prayerType.value = "petition";
    if (els.useLiturgicalTheme) els.useLiturgicalTheme.checked = true;
    renderPrayer();
  });

  if (els.prayerType) {
    els.prayerType.addEventListener("change", () => {
      state.variation = 0;
      renderPrayer();
    });
  }

  els.generate.addEventListener("click", () => {
    state.variation = 0;
    state.selectedTheme = ""; // derive from inputs/day
    renderPrayer();
  });

  els.variation.addEventListener("click", () => {
    state.variation += 1;
    renderPrayer();
  });

  els.presetTheme.addEventListener("change", () => {
    if (els.presetTheme.value) {
      els.customTheme.value = "";
    }
  });

  els.customTheme.addEventListener("input", () => {
    if (els.customTheme.value.trim()) {
      els.presetTheme.value = "";
    }
  });

  if (els.resetPrayerConfig) {
    els.resetPrayerConfig.addEventListener("click", () => {
      state.selectedTheme = "";
      state.variation = 0;
      if (els.customTheme) els.customTheme.value = "";
      if (els.presetTheme) els.presetTheme.value = "";
      if (els.prayerType) els.prayerType.value = "petition";
      if (els.useLiturgicalTheme) els.useLiturgicalTheme.checked = true;
      renderPrayer();
    });
  }

  if (els.useLiturgicalTheme) {
    els.useLiturgicalTheme.addEventListener("change", () => {
      state.variation = 0;
      renderPrayer();
    });
  }

  els.copy.addEventListener("click", async () => {
    const text = els.prayerText.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      els.copy.textContent = "Copié !";
      setTimeout(() => (els.copy.textContent = "Copier"), 1500);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      els.copy.textContent = "Copié !";
      setTimeout(() => (els.copy.textContent = "Copier"), 1500);
    }
  });

  els.fetchExternal.addEventListener("click", () => loadExternalPrayer());
  els.fetchAnnouncements.addEventListener("click", () => loadLatestAnnouncements());
  els.fetchAll.addEventListener("click", loadAllExternal);

  // init
  renderToday();
  renderPrayer();
})();
