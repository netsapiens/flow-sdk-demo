/**
 * The Component Showcase's own copy, in each language the app ships.
 *
 * Only the visible framing is here: the page header, the opening panel and the
 * group headings. The per-component prose further down, component names and
 * every code snippet stay English — component names are API, and snippets are
 * code. Words Flow already translates (Save, Apps, Templates, Localization…)
 * are NOT here: they come from `t(key)`, so they always match the host.
 *
 * `en` defines the shape; the other dictionaries must match it exactly, so a
 * missing string is a type error rather than a blank on screen.
 *
 * The French and Spanish are the demo's own translations: have a native
 * speaker review them before showing them to a customer in that language.
 */
import type { AppLanguage } from '../../i18n/useAppText';

const en = {
  pageTitle: 'Component Showcase',
  pageSubtitle:
    'Every shared component the host hands your app, with the code to use it',
  showCode: 'Show code',
  hideCode: 'Hide code',
  showCodeTooltip: 'Show the copy-paste snippet under each component',
  hideCodeTooltip: 'Collapse every snippet and read the gallery on its own',

  groups: {
    foundations: {
      title: 'Foundations',
      blurb:
        'Text, surfaces and the layout primitives everything else sits on.',
    },
    inputs: {
      title: 'Inputs',
      blurb: 'Controls a user types into, picks from, or toggles.',
    },
    feedback: {
      title: 'Feedback & navigation',
      blurb:
        'Telling the user what happened, what something is, and where they are.',
    },
    data: {
      title: 'Data display',
      blurb:
        'Components that draw your data. These are also what dashboard widgets are built from, which is why they match the native cards exactly.',
    },
    templates: {
      blurb:
        'Whole page and panel shells on ui.templates — the fastest route to a page that looks native, the host owns the layout and you own only the content.',
    },
  },

  intro: {
    title: 'The Flow component kit',
    lead: 'Your app runs inside Flow as a Module Federation remote. Rather than asking you to match our look, the host hands your app the very components it renders itself. Build from these and your feature is indistinguishable from a native page — in every tenant’s branding, in both colour modes, on day one.',
    localizationBefore:
      'This page speaks your language two ways. Words Flow already has — the chips below — come from the host’s own translations through t(). Everything else here is the app’s own copy, from dictionaries it ships and picks by locale. Switch language with the flag in the top bar and both change live; choose',
    localizationAfter:
      'to see which strings are Flow’s: those turn into keys, the app’s own stay as they are.',
    points: [
      {
        icon: 'mdi:palette-outline',
        title: 'It is the tenant theme, not a copy of it',
        body: 'Components arrive already wired to the running theme, so a reseller who rebrands Flow rebrands your app at the same moment. Nothing to re-skin, nothing to keep in sync.',
      },
      {
        icon: 'mdi:weather-night',
        title: 'Light and dark follow for free',
        body: 'Colours resolve at render from palette paths. Your app follows the toggle without subscribing to anything or re-reading a token.',
      },
      {
        icon: 'mdi:package-variant-closed',
        title: 'No MUI in your bundle',
        body: 'The kit is handed over at runtime by the host, which already loaded it. Your remote ships your code and nothing else.',
      },
      {
        icon: 'mdi:human-cane',
        title: 'Accessibility comes with the component',
        body: 'Focus rings, ARIA wiring, keyboard activation and hit targets are handled for you. You inherit the fixes as we make them.',
      },
    ],
    apiTitle: 'The whole API',
    apiBody:
      'One hook, one destructure, one guard. The guard matters: your app may be mounted by a host that predates a component, so treat every one as optional and render a fallback rather than crashing the page.',
    tip: '💡 The one rule worth memorising: pass colours as palette paths (‘text.secondary’, ‘primary.main’, ‘divider’), never as hex and never read out of a theme object you captured earlier. A captured token is a snapshot of whichever mode was active when your app loaded, and it stops following the toggle.',
  },
};

export type ShowcaseText = typeof en;

const fr: ShowcaseText = {
  pageTitle: 'Vitrine des composants',
  pageSubtitle:
    'Chaque composant partagé que l’hôte fournit à votre application, avec le code pour l’utiliser',
  showCode: 'Afficher le code',
  hideCode: 'Masquer le code',
  showCodeTooltip: 'Afficher l’extrait à copier sous chaque composant',
  hideCodeTooltip: 'Replier tous les extraits et parcourir la vitrine seule',

  groups: {
    foundations: {
      title: 'Fondations',
      blurb:
        'Le texte, les surfaces et les primitives de mise en page sur lesquelles tout le reste repose.',
    },
    inputs: {
      title: 'Saisie',
      blurb:
        'Les contrôles dans lesquels l’utilisateur tape, choisit ou bascule.',
    },
    feedback: {
      title: 'Retour et navigation',
      blurb:
        'Dire à l’utilisateur ce qui s’est passé, ce qu’est une chose et où il se trouve.',
    },
    data: {
      title: 'Affichage des données',
      blurb:
        'Les composants qui dessinent vos données. Ce sont aussi ceux des widgets du tableau de bord, d’où leur ressemblance exacte avec les cartes natives.',
    },
    templates: {
      blurb:
        'Des gabarits complets de page et de panneau dans ui.templates — le chemin le plus court vers une page d’apparence native : l’hôte gère la mise en page, vous ne gérez que le contenu.',
    },
  },

  intro: {
    title: 'La trousse de composants Flow',
    lead: 'Votre application s’exécute dans Flow comme module distant Module Federation. Plutôt que de vous demander d’imiter notre apparence, l’hôte fournit à votre application les composants mêmes qu’il affiche. Construisez avec eux et votre fonctionnalité ne se distingue pas d’une page native — aux couleurs de chaque client, dans les deux modes, dès le premier jour.',
    localizationBefore:
      'Cette page parle votre langue de deux façons. Les mots que Flow possède déjà — les puces ci-dessous — viennent des traductions de l’hôte par t(). Tout le reste ici est le texte de l’application, tiré de dictionnaires qu’elle fournit et choisit selon la langue. Changez de langue avec le drapeau dans la barre du haut et les deux changent en direct ; choisissez',
    localizationAfter:
      'pour voir quels textes viennent de Flow : ceux-là deviennent des clés, ceux de l’application restent tels quels.',
    points: [
      {
        icon: 'mdi:palette-outline',
        title: 'C’est le thème du client, pas une copie',
        body: 'Les composants arrivent déjà reliés au thème en cours : un revendeur qui change l’image de Flow change aussi celle de votre application, au même moment. Rien à rhabiller, rien à synchroniser.',
      },
      {
        icon: 'mdi:weather-night',
        title: 'Le clair et le sombre suivent d’office',
        body: 'Les couleurs se résolvent à l’affichage à partir de chemins de palette. Votre application suit la bascule sans s’abonner à quoi que ce soit ni relire un jeton.',
      },
      {
        icon: 'mdi:package-variant-closed',
        title: 'Aucun MUI dans votre bundle',
        body: 'La trousse est remise à l’exécution par l’hôte, qui l’a déjà chargée. Votre module distant ne livre que votre code.',
      },
      {
        icon: 'mdi:human-cane',
        title: 'L’accessibilité vient avec le composant',
        body: 'Anneaux de focus, attributs ARIA, activation au clavier et zones de clic sont gérés pour vous. Vous héritez des correctifs à mesure que nous les apportons.',
      },
    ],
    apiTitle: 'Toute l’API',
    apiBody:
      'Un crochet, une déstructuration, une garde. La garde compte : votre application peut être montée par un hôte plus ancien qu’un composant, alors traitez chacun comme facultatif et affichez une solution de repli plutôt que de faire planter la page.',
    tip: '💡 La seule règle à retenir : passez les couleurs comme chemins de palette (‘text.secondary’, ‘primary.main’, ‘divider’), jamais en hexadécimal ni lues dans un objet de thème capturé plus tôt. Un jeton capturé est un instantané du mode actif au chargement de votre application, et il cesse de suivre la bascule.',
  },
};

const es: ShowcaseText = {
  pageTitle: 'Catálogo de componentes',
  pageSubtitle:
    'Cada componente compartido que el host entrega a tu aplicación, con el código para usarlo',
  showCode: 'Mostrar código',
  hideCode: 'Ocultar código',
  showCodeTooltip: 'Mostrar el fragmento para copiar bajo cada componente',
  hideCodeTooltip: 'Contraer todos los fragmentos y recorrer solo el catálogo',

  groups: {
    foundations: {
      title: 'Fundamentos',
      blurb:
        'El texto, las superficies y las primitivas de diseño sobre las que se apoya todo lo demás.',
    },
    inputs: {
      title: 'Entradas',
      blurb:
        'Controles en los que el usuario escribe, elige o activa y desactiva.',
    },
    feedback: {
      title: 'Avisos y navegación',
      blurb: 'Decirle al usuario qué pasó, qué es algo y dónde está.',
    },
    data: {
      title: 'Presentación de datos',
      blurb:
        'Componentes que dibujan tus datos. También son la base de los widgets del tablero, por eso coinciden exactamente con las tarjetas nativas.',
    },
    templates: {
      blurb:
        'Estructuras completas de página y panel en ui.templates: la vía más rápida hacia una página de aspecto nativo; el host se encarga del diseño y tú solo del contenido.',
    },
  },

  intro: {
    title: 'El kit de componentes de Flow',
    lead: 'Tu aplicación se ejecuta dentro de Flow como un módulo remoto de Module Federation. En lugar de pedirte que imites nuestro aspecto, el host le entrega a tu aplicación los mismos componentes que él muestra. Construye con ellos y tu función será indistinguible de una página nativa: con la marca de cada cliente, en ambos modos de color, desde el primer día.',
    localizationBefore:
      'Esta página habla tu idioma de dos maneras. Las palabras que Flow ya tiene —las etiquetas de abajo— vienen de las traducciones del host mediante t(). Todo lo demás es el texto propio de la aplicación, de diccionarios que ella incluye y elige según el idioma. Cambia de idioma con la bandera de la barra superior y ambos cambian al instante; elige',
    localizationAfter:
      'para ver qué textos son de Flow: esos se convierten en claves y los de la aplicación quedan igual.',
    points: [
      {
        icon: 'mdi:palette-outline',
        title: 'Es el tema del cliente, no una copia',
        body: 'Los componentes llegan ya conectados al tema activo: un revendedor que cambia la marca de Flow cambia la de tu aplicación en el mismo momento. Nada que volver a vestir ni mantener sincronizado.',
      },
      {
        icon: 'mdi:weather-night',
        title: 'Claro y oscuro sin esfuerzo',
        body: 'Los colores se resuelven al dibujar a partir de rutas de paleta. Tu aplicación sigue el cambio de modo sin suscribirse a nada ni volver a leer un token.',
      },
      {
        icon: 'mdi:package-variant-closed',
        title: 'Nada de MUI en tu bundle',
        body: 'El host entrega el kit en tiempo de ejecución, porque ya lo cargó. Tu módulo remoto solo incluye tu código.',
      },
      {
        icon: 'mdi:human-cane',
        title: 'La accesibilidad viene con el componente',
        body: 'Anillos de foco, atributos ARIA, activación con teclado y áreas de clic ya están resueltos. Heredas las correcciones a medida que las hacemos.',
      },
    ],
    apiTitle: 'Toda la API',
    apiBody:
      'Un hook, una desestructuración, una guarda. La guarda importa: tu aplicación puede montarse en un host anterior a un componente, así que trata cada uno como opcional y muestra una alternativa en lugar de romper la página.',
    tip: '💡 La única regla que vale la pena memorizar: pasa los colores como rutas de paleta (‘text.secondary’, ‘primary.main’, ‘divider’), nunca en hexadecimal ni leídos de un objeto de tema capturado antes. Un token capturado es una instantánea del modo activo cuando cargó tu aplicación y deja de seguir el cambio.',
  },
};

export const SHOWCASE_TEXT: Record<AppLanguage, ShowcaseText> = { en, fr, es };
