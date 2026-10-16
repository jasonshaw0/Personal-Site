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
  visual: 'cad' | 'resources' | 'crossplay' | 'dates'
  tags: string[]
  href: string
  linkLabel: string
}

export const projects: Project[] = [
  { id: '01', category: 'CAD & developer tools', title: 'CAD Harness', description: 'An experimental framework and Studio for editable, parametric CAD. Build123d models are checked against explicit requirements, with measured geometry and revision-linked evidence.', visual: 'cad', tags: ['Python', 'build123d', 'MCP'], href: 'https://github.com/jasonshaw0/CAD-Harness', linkLabel: 'GitHub source' },
  { id: '02', category: 'Engineering education', title: 'The Foundations Resource Hub', description: 'A course resource for USF’s Foundations of Engineering Lab, bringing together Arduino programming, practical electronics, 3D printing guides, and quiz tools for Canvas.', visual: 'resources', tags: ['Arduino', 'Sphinx', 'Python'], href: 'https://github.com/trevorflahardy/The-Foundations-Resource-Hub', linkLabel: 'GitHub source' },
  { id: '03', category: 'Local-first web application', title: 'Crossplay Solver', description: 'A browser-based solver for NYT Crossplay. Reconstruct a board from a screenshot, explore legal plays, and inspect exact scoring. Image recognition and solving run locally.', visual: 'crossplay', tags: ['TypeScript', 'Computer vision'], href: 'https://github.com/jasonshaw0/crossplay-solver', linkLabel: 'GitHub source' },
  { id: '04', category: 'Chrome extension', title: 'Exact Upload Dates for YouTube', description: 'Replaces relative video ages with calendar dates across YouTube. Batched API requests and a local cache keep browsing responsive. Requires a YouTube Data API key.', visual: 'dates', tags: ['JavaScript', 'YouTube API'], href: 'https://chromewebstore.google.com/detail/exact-upload-dates-for-yo/iaolkhgmaeecdlcflkedelafhhmpdagk', linkLabel: 'Chrome Web Store' },
]

export const disciplines = [
  { number: '01', name: 'Software development', note: 'Primary focus', description: 'Applications, interfaces, and the tools behind them. From Python utilities to full-stack web development.', groups: [
    { label: 'Languages', items: ['Python', 'C++', 'JavaScript', 'HTML / CSS'] },
    { label: 'Practice & tools', items: ['Web applications', 'UI development', 'Git', 'Linux', 'Technical documentation'] },
  ] },
  { number: '02', name: 'Electrical & embedded', note: 'From code to circuits', description: 'Firmware, sensors, and motion control. Working across the boundary between software and the hardware it drives.', groups: [
    { label: 'Platforms', items: ['STM32', 'ESP32', 'Embedded C / C++'] },
    { label: 'Systems', items: ['Sensor integration', 'Servo / stepper control', 'Bluetooth / Wi-Fi'] },
  ] },
  { number: '03', name: 'Mechanical & fabrication', note: 'From model to object', description: 'Parametric design and hands-on prototyping. Taking mechanical constraints into account from the beginning.', groups: [
    { label: 'Design', items: ['Fusion 360', 'SolidWorks', 'Parametric CAD'] },
    { label: 'Fabrication', items: ['3D printing', 'Rapid prototyping', 'Prusa MK4S'] },
  ] },
]
