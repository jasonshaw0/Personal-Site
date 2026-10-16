export const profile = {
  name: 'Jason Shaw',
  github: 'https://github.com/jasonshaw0',
  linkedin: 'https://www.linkedin.com/in/jason-shaw-a590a5333/',
  youtube: 'https://www.youtube.com/@slaxxis',
  instagram: 'https://www.instagram.com/jason._.shaw/',
  contactEndpoint: '/api/contact',
}

export type Project = {
  id: string
  category: string
  title: string
  description: string
  visual: 'cad' | 'resources' | 'crossplay' | 'dates' | 'atlas' | 'drivester'
  tags: string[]
  href: string
  linkLabel: string
}

export const projects: Project[] = [
  { id: '01', category: 'CAD & developer tools', title: 'CAD Harness', description: 'Editable parametric CAD in Python and build123d, with MCP integration. CAD Harness Studio brings 3D inspection, geometry measurements, and engineering requirement checks together with revision-linked evidence.', visual: 'cad', tags: ['Python', 'build123d', 'MCP'], href: 'https://github.com/jasonshaw0/CAD-Harness', linkLabel: 'GitHub source' },
  { id: '02', category: 'Engineering education', title: 'The Foundations Resource Hub', description: 'A collaborative resource for USF’s Foundations of Engineering Lab (EGN 3000L). As a Project Support TA and secondary author, I contributed to guides covering Arduino programming, electronics, and 3D printing.', visual: 'resources', tags: ['Arduino', 'Sphinx', 'Python'], href: 'https://github.com/trevorflahardy/The-Foundations-Resource-Hub', linkLabel: 'GitHub source' },
  { id: '03', category: 'Local-first web application', title: 'Crossplay Solver', description: 'Reconstructs NYT Crossplay boards from screenshots using local image recognition. A deterministic trie solver finds legal plays and ranks them by exact immediate score, with word-by-word scoring. Screenshots stay in the browser.', visual: 'crossplay', tags: ['TypeScript', 'Next.js', 'Web Workers'], href: 'https://github.com/jasonshaw0/crossplay-solver', linkLabel: 'GitHub source' },
  { id: '04', category: 'Chrome extension', title: 'Exact Upload Dates for YouTube', description: 'A published Chrome extension that replaces relative video ages with calendar dates directly on YouTube. Uses the YouTube Data API, batched requests, and locally cached dates. Requires the user’s own API key.', visual: 'dates', tags: ['JavaScript', 'YouTube Data API'], href: 'https://chromewebstore.google.com/detail/exact-upload-dates-for-yo/iaolkhgmaeecdlcflkedelafhhmpdagk', linkLabel: 'Chrome Web Store' },
  { id: '05', category: 'History & web applications', title: 'Atlas of War: WWII', description: 'World War II trivia built around sourced historical content. Human-readable YAML links sources, evidence, facts, and questions; schema and publication checks compile it into SQLite for filtered quizzes with explanations and citations.', visual: 'atlas', tags: ['Next.js', 'TypeScript', 'SQLite'], href: 'https://github.com/jasonshaw0/atlas-of-war-quiz', linkLabel: 'GitHub source' },
  { id: '06', category: 'Desktop & motor control', title: 'Drivester', description: 'A Python desktop toolkit connecting a PyQt interface to microcontroller firmware over serial. Test stepper speed and direction, set target angles with an interactive dial, remap keyboard shortcuts, and play musical notes through motor pulses.', visual: 'drivester', tags: ['Python', 'PyQt5', 'pySerial'], href: 'https://github.com/jasonshaw0/Drivester', linkLabel: 'GitHub source' },
]

export const disciplines = [
  { number: '01', name: 'Software development', note: 'Primary focus', description: 'Developer tools, web applications, and automation. I work across interfaces and backend APIs, with testing, debugging, and documentation throughout.', groups: [
    { label: 'Languages & frameworks', items: ['Python', 'C / C++', 'JavaScript / TypeScript', 'HTML / CSS', 'React / Next.js'] },
    { label: 'Practice & tools', items: ['APIs & backend development', 'Automation & scripting', 'Testing & debugging', 'Git / GitHub · Linux', 'Technical documentation'] },
  ] },
  { number: '02', name: 'Electrical & embedded', note: 'From code to circuits', description: 'Microcontroller firmware, electronics, and motion control. Building prototypes and troubleshooting the connection between code, circuits, and moving parts.', groups: [
    { label: 'Platforms', items: ['Arduino', 'ESP32 / STM32', 'Embedded C / C++', 'Wi-Fi / Bluetooth'] },
    { label: 'Systems', items: ['Sensors & microcontrollers', 'Stepper / servo control', 'Motor drivers', 'Circuit design & soldering', 'Prototyping & troubleshooting'] },
  ] },
  { number: '03', name: 'Mechanical & fabrication', note: 'From model to object', description: 'Parametric CAD and hands-on fabrication. At USF, I maintained, diagnosed, and repaired 15+ Flashforge Adventurer 5M printers supporting student engineering projects.', groups: [
    { label: 'Design', items: ['SolidWorks / Fusion 360', 'build123d', 'Parametric CAD', 'KiCad / EDA'] },
    { label: 'Fabrication', items: ['Mechanical prototyping', '3D printing', 'Printer maintenance & repair', 'Digital fabrication'] },
  ] },
]
