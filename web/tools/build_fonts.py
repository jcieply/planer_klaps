import base64, json, io
from fontTools.ttLib import TTFont
from fontTools import subset

SRC = {
  'regular': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  'bold':    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
}
cps = set(range(0x20, 0x7F)) | set(range(0xA0, 0x180))
cps |= {0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2022, 0x2026, 0x2116,
        0x215B, 0x215C, 0x215D, 0x215E, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x25CF, 0x2713, 0x2715}
out = {}
for key, path in SRC.items():
    orig = TTFont(path)
    upm = orig['head'].unitsPerEm
    os2 = orig['OS/2']
    info = {
        'upm': upm,
        'ascent': orig['hhea'].ascent,
        'descent': orig['hhea'].descent,
        'cap': getattr(os2, 'sCapHeight', int(upm * 0.7)) or int(upm * 0.7),
        'bbox': [orig['head'].xMin, orig['head'].yMin, orig['head'].xMax, orig['head'].yMax],
        'name': 'LiberationSans' + ('-Bold' if key == 'bold' else ''),
    }
    opts = subset.Options()
    opts.layout_features = []
    opts.hinting = False
    opts.glyph_names = False
    opts.notdef_outline = True
    opts.name_IDs = [1, 2, 4, 6]
    opts.drop_tables += ['GSUB', 'GPOS', 'GDEF', 'kern', 'DSIG', 'hdmx', 'VDMX', 'LTSH', 'meta', 'gasp']
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=cps)
    sub.subset(orig)
    buf = io.BytesIO()
    orig.save(buf)
    data = buf.getvalue()
    f = TTFont(io.BytesIO(data))
    cmap = f.getBestCmap()
    order = f.getGlyphOrder()
    gid = {n: i for i, n in enumerate(order)}
    hmtx = f['hmtx']
    glyphs = {}
    for cp, name in cmap.items():
        glyphs[cp] = [gid[name], hmtx[name][0]]
    info['glyphs'] = glyphs
    info['ttf'] = base64.b64encode(data).decode('ascii')
    info['ttfLen'] = len(data)
    out[key] = info
    print(key, 'glyphs', len(glyphs), 'bytes', len(data), 'upm', upm, 'asc', info['ascent'], 'desc', info['descent'], 'cap', info['cap'])

js = '/* Wygenerowane przez tools/build_fonts.py. Liberation Sans (SIL OFL 1.1), podzbiór: łacina + rozszerzona A. */\nvar KlapsFonts = ' + json.dumps(out, separators=(',', ':')) + ';\nif (typeof module !== \'undefined\' && module.exports) module.exports = KlapsFonts;\n'
open('/home/claude/klaps/src/fonts.js', 'w', encoding='utf-8').write(js)
print('fonts.js', len(js))
