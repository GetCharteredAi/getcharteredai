#!/usr/bin/env python3
"""
generate_employer_guide.py
Generates public/employer-guide.pdf — the editable source for that document.
Run from project root: python3 generate_employer_guide.py
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

NAVY  = HexColor('#0D0F1C')
GOLD  = HexColor('#f59e0b')
BLUE  = HexColor('#2563EB')
SLATE = HexColor('#475569')
MUTED = HexColor('#94a3b8')
GREEN = HexColor('#10b981')
AMBER = HexColor('#d97706')

W, H = A4   # 595.28 × 841.89 pt
M = 20 * mm  # side margin


def wrap(c, text, x, y, max_w, font, size, color, leading=None):
    """Draw left-aligned wrapped text; return y after last line."""
    if leading is None:
        leading = size * 1.4
    c.setFont(font, size)
    c.setFillColor(color)
    words = text.split()
    line, lines = '', []
    for word in words:
        test = (line + ' ' + word).strip()
        if c.stringWidth(test, font, size) <= max_w:
            line = test
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    for l in lines:
        c.drawString(x, y, l)
        y -= leading
    return y


def wrap_centre(c, text, cx, y, max_w, font, size, color, leading=None):
    """Draw centre-aligned wrapped text; return y after last line."""
    if leading is None:
        leading = size * 1.4
    c.setFont(font, size)
    c.setFillColor(color)
    words = text.split()
    line, lines = '', []
    for word in words:
        test = (line + ' ' + word).strip()
        if c.stringWidth(test, font, size) <= max_w:
            line = test
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    for l in lines:
        c.drawCentredString(cx, y, l)
        y -= leading
    return y


def footer(c):
    c.setFillColor(NAVY)
    c.rect(0, 0, W, 8 * mm, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 8)
    c.drawCentredString(W / 2, 2.8 * mm,
        'Get Chartered AI  ·  getcharteredai.com  ·  info@getcharteredai.com  ·  Updated for 2026')


def page1(c):
    # ── HEADER ──────────────────────────────────────────────────────────────
    c.setFillColor(NAVY)
    c.rect(0, H - 22 * mm, W, 22 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 15)
    c.drawString(M, H - 9 * mm, 'GET CHARTERED AI')
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 8)
    c.drawString(M, H - 15 * mm, 'getcharteredai.com')
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 9)
    c.drawRightString(W - M, H - 11 * mm, 'EMPLOYER & COHORT ACCESS GUIDE')

    # ── HERO ────────────────────────────────────────────────────────────────
    y = H - 34 * mm
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 20)
    c.drawString(M, y, 'The APC preparation platform for your whole cohort')
    y -= 8 * mm
    y = wrap(c,
        'Structured learning, AI-coached practice and mock interview simulation — available as cohort '
        'access for your APC candidates. Built by Chartered Surveyors who have sat on assessment panels.',
        M, y, W - 2 * M, 'Helvetica', 10, SLATE, 5 * mm) - 5 * mm

    # ── STATS BAR ───────────────────────────────────────────────────────────
    bar_h = 18 * mm
    c.setFillColor(NAVY)
    c.rect(0, y - bar_h, W, bar_h, fill=1, stroke=0)
    stats = [('12', 'STRUCTURED MODULES'), ('22', 'RICS PATHWAYS COVERED'), ('5,000+', 'PRACTICE QUESTIONS')]
    col = W / 3
    for i, (num, lbl) in enumerate(stats):
        cx = col * i + col / 2
        c.setFillColor(GOLD)
        c.setFont('Helvetica-Bold', 18)
        c.drawCentredString(cx, y - 9 * mm, num)
        c.setFillColor(MUTED)
        c.setFont('Helvetica-Bold', 7)
        c.drawCentredString(cx, y - 14 * mm, lbl)
        if i < 2:
            c.setStrokeColor(HexColor('#1e293b'))
            c.setLineWidth(0.5)
            c.line(col * (i + 1), y - bar_h + 3 * mm, col * (i + 1), y - 3 * mm)
    y -= bar_h + 10 * mm

    # ── THE PROBLEM ──────────────────────────────────────────────────────────
    c.setFillColor(BLUE)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawString(M, y, 'THE PROBLEM')
    y -= 5 * mm
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 13)
    c.drawString(M, y, 'Most APC referrals are not caused by lack of knowledge')
    y -= 7 * mm
    y = wrap(c,
        'They happen because technically capable candidates cannot demonstrate what they know in the '
        'format assessors require. Counsellor support is valuable — but it rarely addresses this gap specifically.',
        M, y, W - 2 * M, 'Helvetica', 10, SLATE, 5 * mm) - 5 * mm

    bullets = [
        ('Evidencing gaps, not knowledge gaps',
         'Candidates describe their work rather than evidence professional judgement. '
         'Get Chartered AI teaches the specific structure assessors score.'),
        ('No structured mock interview practice',
         'Most candidates arrive at final assessment having never answered a probing follow-up '
         'question under pressure. The 60-minute AI simulator changes that.'),
        ('Counsellors cannot be available 24/7',
         'Michael — the AI Tutor — is available whenever your candidates need it, '
         'not just during counsellor sessions.'),
    ]
    for bold, body in bullets:
        c.setFillColor(GOLD)
        c.circle(M + 2 * mm, y + 1.5 * mm, 1.5 * mm, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 10)
        c.drawString(M + 6 * mm, y, bold + ' —')
        y -= 5 * mm
        y = wrap(c, body, M + 6 * mm, y, W - 2 * M - 6 * mm, 'Helvetica', 9.5, SLATE, 4.5 * mm) - 3 * mm
    y -= 4 * mm

    # ── THE COMMERCIAL CASE ───────────────────────────────────────────────────
    c.setFillColor(BLUE)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawString(M, y, 'THE COMMERCIAL CASE')
    y -= 5 * mm
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 13)
    c.drawString(M, y, 'A referral costs your firm significantly more than cohort access')
    y -= 7 * mm
    wrap(c,
        'Every referral extends a candidate\'s training period by at least 6 months — with associated salary, '
        'supervision time and delayed productivity. Cohort access costs a fraction of that for your whole cohort. '
        'Firms that invest in structured APC preparation see higher first-time pass rates, shorter time to '
        'chartership and stronger retention of candidates who feel supported.',
        M, y, W - 2 * M, 'Helvetica', 10, SLATE, 5 * mm)

    footer(c)


def page2(c):
    # ── HEADER ──────────────────────────────────────────────────────────────
    c.setFillColor(NAVY)
    c.rect(0, H - 18 * mm, W, 18 * mm, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 10)
    c.drawCentredString(W / 2, H - 11 * mm, 'FOUR PROGRAMMES — ONE FOR EVERY CANDIDATE')

    y = H - 26 * mm
    c.setFillColor(SLATE)
    c.setFont('Helvetica', 10)
    c.drawCentredString(W / 2, y, 'Each candidate gets the programme that matches where they are.')
    y -= 10 * mm

    # ── FOUR PROGRAMME CARDS ─────────────────────────────────────────────────
    gap = 3 * mm
    card_w = (W - 2 * M - 3 * gap) / 4
    card_h = 76 * mm

    progs = [
        dict(label='FULL APC PROGRAMME', price='£497', sub='one-off · 18 months access',
             desc='Preparing from the start of structured training',
             feats=['All 12 modules — immediate access',
                    'All 11 mandatory competencies',
                    'Michael 24/7 — Tutor & Assessor Mode',
                    '60-min mock interview · all 22 pathways',
                    '5,000+ practice questions',
                    'Updated for 2026 RICS standards'],
             accent=BLUE, bg=HexColor('#eff6ff')),
        dict(label='APC FINAL SPRINT', price='£297', sub='one-off · focused programme',
             desc='Final weeks before assessment',
             feats=['Targeted competency revision',
                    '60-min mock interview · all 22 pathways',
                    'Michael 24/7 — Tutor & Assessor Mode',
                    '5,000+ practice questions'],
             accent=NAVY, bg=HexColor('#f8fafc')),
        dict(label='REFERRED RECOVERY', price='£397', sub='one-off · 90 days',
             desc='Structured resit preparation after referral',
             feats=['9 CR modules (CR01–CR09)',
                    'Root cause analysis of referral',
                    'Rebuilding evidence structure',
                    'Michael in Assessor Mode',
                    'Resit preparation focus'],
             accent=AMBER, bg=HexColor('#fffbeb')),
        dict(label='YEAR TWO READINESS', price='£127', sub='one-off · standalone diagnostic',
             desc='Benchmark at the start of Year Two',
             feats=['32 diagnostic questions',
                    '5 readiness areas',
                    'Personalised report from Michael',
                    'Not a training programme'],
             accent=GREEN, bg=HexColor('#f0fdf4')),
    ]

    for i, p in enumerate(progs):
        cx = M + i * (card_w + gap)
        cy = y - card_h
        # Background
        c.setFillColor(p['bg'])
        c.setStrokeColor(HexColor('#e2e8f0'))
        c.setLineWidth(0.5)
        c.roundRect(cx, cy, card_w, card_h, 2.5 * mm, fill=1, stroke=1)
        # Accent top border
        c.setStrokeColor(p['accent'])
        c.setLineWidth(2.5)
        c.line(cx + 3 * mm, cy + card_h - 0.5, cx + card_w - 3 * mm, cy + card_h - 0.5)

        ty = cy + card_h - 6 * mm
        # Label
        c.setFillColor(p['accent'])
        c.setFont('Helvetica-Bold', 6.5)
        lw = c.stringWidth(p['label'], 'Helvetica-Bold', 6.5)
        c.drawString(cx + (card_w - lw) / 2, ty, p['label'])
        ty -= 5 * mm
        # Price
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 17)
        pw = c.stringWidth(p['price'], 'Helvetica-Bold', 17)
        c.drawString(cx + (card_w - pw) / 2, ty, p['price'])
        ty -= 5 * mm
        # Sub
        c.setFillColor(MUTED)
        c.setFont('Helvetica', 7)
        sw = c.stringWidth(p['sub'], 'Helvetica', 7)
        c.drawString(cx + (card_w - sw) / 2, ty, p['sub'])
        ty -= 5 * mm
        # Desc (centred, wrapped)
        ty = wrap_centre(c, p['desc'], cx + card_w / 2, ty,
                         card_w - 6 * mm, 'Helvetica', 8, SLATE, 4 * mm) - 3 * mm
        # Divider
        c.setStrokeColor(HexColor('#e2e8f0'))
        c.setLineWidth(0.3)
        c.line(cx + 4 * mm, ty + 2 * mm, cx + card_w - 4 * mm, ty + 2 * mm)
        ty -= 3.5 * mm
        # Features
        for feat in p['feats']:
            c.setFillColor(GREEN)
            c.circle(cx + 4 * mm, ty + 1.5 * mm, 1 * mm, fill=1, stroke=0)
            ty = wrap(c, feat, cx + 7 * mm, ty, card_w - 9 * mm,
                      'Helvetica', 7.5, SLATE, 3.5 * mm) - 0.5 * mm

    y -= card_h + 10 * mm

    # ── COHORT PRICING ────────────────────────────────────────────────────────
    band_h = 22 * mm
    c.setFillColor(NAVY)
    c.rect(0, y - band_h, W, band_h, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawCentredString(W / 2, y - 5.5 * mm, 'COHORT PRICING')
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 11)
    c.drawCentredString(W / 2, y - 11 * mm, 'Standard per-candidate pricing — no minimums.')
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 8.5)
    c.drawCentredString(W / 2, y - 17 * mm,
        'All four programmes at the same price for every candidate. Enquire for a coordinated proposal.')
    y -= band_h + 7 * mm

    # CTA button
    btn_w, btn_h = 52 * mm, 8 * mm
    bx = (W - btn_w) / 2
    c.setFillColor(GOLD)
    c.roundRect(bx, y - btn_h, btn_w, btn_h, 2 * mm, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 9)
    c.drawCentredString(W / 2, y - 5.5 * mm, 'Enquire about cohort access  →')
    y -= btn_h + 12 * mm

    # ── GETTING STARTED ───────────────────────────────────────────────────────
    c.setFillColor(BLUE)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawCentredString(W / 2, y, 'GETTING STARTED')
    y -= 6 * mm
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 13)
    c.drawCentredString(W / 2, y, 'Up and running in days, not weeks')
    y -= 12 * mm

    steps = [
        ('01', 'Enquire',
         'Tell us your cohort size — proposal within one working day.'),
        ('02', 'Agree terms',
         'Simple agreement — Stripe payment links arranged for your cohort.'),
        ('03', 'Candidates onboard',
         'Each candidate completes their own quick setup — enter your email and set a password. '
         'Full access from the moment you\'re in.'),
        ('04', 'They prepare',
         'Self-paced alongside your internal programme. Counsellors get the free guide too.'),
    ]

    step_w = (W - 2 * M - 3 * gap) / 4
    circle_y = y
    for i, (num, head, body) in enumerate(steps):
        sx = M + i * (step_w + gap)
        # Circle
        ccx = sx + step_w / 2
        c.setFillColor(NAVY)
        c.circle(ccx, circle_y, 7 * mm, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont('Helvetica-Bold', 11)
        nw = c.stringWidth(num, 'Helvetica-Bold', 11)
        c.drawString(ccx - nw / 2, circle_y - 3.5 * mm, num)
        # Heading
        ty = circle_y - 12 * mm
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 9.5)
        hw = c.stringWidth(head, 'Helvetica-Bold', 9.5)
        c.drawString(sx + (step_w - hw) / 2, ty, head)
        ty -= 5 * mm
        # Body
        wrap_centre(c, body, sx + step_w / 2, ty, step_w - 4 * mm, 'Helvetica', 8, SLATE, 4 * mm)
        # Connector (dashed line between circles)
        if i < 3:
            nx = M + (i + 1) * (step_w + gap) + step_w / 2
            c.setStrokeColor(HexColor('#cbd5e1'))
            c.setLineWidth(0.5)
            c.setDash(3, 3)
            c.line(ccx + 7 * mm, circle_y, nx - 7 * mm, circle_y)
            c.setDash()

    footer(c)


def main():
    out = '/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/employer-guide.pdf'
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle('Get Chartered AI — Employer & Cohort Access Guide')
    c.setAuthor('Get Chartered AI')
    c.setSubject('APC Employer Guide 2026')
    page1(c)
    c.showPage()
    page2(c)
    c.save()
    print(f'Generated: {out}')


if __name__ == '__main__':
    main()
