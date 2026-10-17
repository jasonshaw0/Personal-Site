import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#111315"/>
<path d="M64 118H1136M64 550H1136" stroke="#303538"/>
<g font-family="Arial, sans-serif"><text x="64" y="82" fill="#bfd4cd" font-size="27">jason shaw.</text><text x="1136" y="82" text-anchor="end" fill="#a0a7a9" font-size="20">WRITING</text>
<text x="64" y="252" fill="#dbe0dd" font-size="83" letter-spacing="-4">A little further</text>
<text x="64" y="345" fill="#909b9e" font-size="83" letter-spacing="-4">into the details.</text>
<text x="68" y="435" fill="#a0a7a9" font-size="25">Notes on software, engineering, and making things work.</text>
<text x="64" y="593" fill="#a0a7a9" font-size="19">jason-shaw.com/blog</text><text x="1136" y="593" text-anchor="end" fill="#bfd4cd" font-size="24">↗</text></g></svg>`
await sharp(Buffer.from(svg)).png().toFile('public/blog-og.png')
console.log('Generated public/blog-og.png (1200 × 630).')
