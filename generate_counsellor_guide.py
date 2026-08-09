#!/usr/bin/env python3
"""
generate_counsellor_guide.py
Generates public/counsellor-guide.pdf — the editable source for that document.
Run from project root: python3 generate_counsellor_guide.py
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

W, H = A4
M = 20 * mm


def wrap(c, text, x, y, max_w, font, size, color, leading=None):
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


def page_header(c, page_num):
    c.setFillColor(NAVY)
    c.rect(0, H - 18 * mm, W, 18 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 13)
    c.drawString(M, H - 10 * mm, 'GET CHARTERED AI')
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 8)
    c.drawString(M, H - 16 * mm, 'getcharteredai.com')
    c.setFillColor(white)
    c.setFont('Helvetica-Bold', 9)
    c.drawRightString(W - M, H - 11 * mm, 'APC COUNSELLOR & SUPERVISOR GUIDE 2026')
    if page_num > 1:
        c.setFillColor(MUTED)
        c.setFont('Helvetica', 8)
        c.drawRightString(W - M, H - 16 * mm, f'Page {page_num}')


def page_footer(c):
    c.setFillColor(NAVY)
    c.rect(0, 0, W, 8 * mm, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont('Helvetica', 8)
    c.drawCentredString(W / 2, 2.8 * mm,
        'Get Chartered AI  ·  getcharteredai.com  ·  info@getcharteredai.com  ·  Updated for 2026')


def update_card(c, y, label, text, label_color=BLUE):
    card_h_approx = 22 * mm
    # Border box
    c.setFillColor(HexColor('#eff6ff'))
    c.setStrokeColor(HexColor('#bfdbfe'))
    c.setLineWidth(0.5)
    c.roundRect(M, y - card_h_approx, W - 2 * M, card_h_approx, 2 * mm, fill=1, stroke=1)
    # Label
    ty = y - 6 * mm
    c.setFillColor(label_color)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawString(M + 4 * mm, ty, label)
    ty -= 5 * mm
    # Text — wrapped
    final_y = wrap(c, text, M + 4 * mm, ty, W - 2 * M - 8 * mm, 'Helvetica', 9, SLATE, 4.5 * mm)
    # Return actual bottom of used space (with a small buffer)
    return min(y - card_h_approx, final_y) - 3 * mm


def warn_box(c, y, text):
    c.setFillColor(HexColor('#fffbeb'))
    c.setStrokeColor(HexColor('#fcd34d'))
    c.setLineWidth(0.5)
    c.roundRect(M, y - 20 * mm, W - 2 * M, 20 * mm, 2 * mm, fill=1, stroke=1)
    ty = y - 5 * mm
    c.setFillColor(AMBER)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(M + 4 * mm, ty, 'Why this matters:')
    ty -= 5 * mm
    return wrap(c, text, M + 4 * mm, ty, W - 2 * M - 8 * mm, 'Helvetica', 9, SLATE, 4.5 * mm) - 3 * mm


def green_box(c, y, text):
    c.setFillColor(HexColor('#f0fdf4'))
    c.setStrokeColor(HexColor('#86efac'))
    c.setLineWidth(0.5)
    c.roundRect(M, y - 24 * mm, W - 2 * M, 24 * mm, 2 * mm, fill=1, stroke=1)
    ty = y - 5 * mm
    c.setFillColor(GREEN)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(M + 4 * mm, ty, 'How Get Chartered AI supports your candidates:')
    ty -= 5 * mm
    return wrap(c, text, M + 4 * mm, ty, W - 2 * M - 8 * mm, 'Helvetica', 9, SLATE, 4.5 * mm) - 3 * mm


def section_heading(c, y, label, heading):
    c.setFillColor(BLUE)
    c.setFont('Helvetica-Bold', 7.5)
    c.drawString(M, y, label)
    y -= 5 * mm
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 13)
    c.drawString(M, y, heading)
    return y - 7 * mm


def bullet(c, y, text, bold_prefix=None):
    c.setFillColor(GOLD)
    c.circle(M + 2 * mm, y + 1.5 * mm, 1.5 * mm, fill=1, stroke=0)
    tx = M + 7 * mm
    if bold_prefix:
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 9.5)
        prefix_w = c.stringWidth(bold_prefix + ' — ', 'Helvetica-Bold', 9.5)
        c.drawString(tx, y, bold_prefix + ' — ')
        # rest on next line (indented)
        y -= 4.5 * mm
        return wrap(c, text, tx, y, W - 2 * M - 7 * mm, 'Helvetica', 9.5, SLATE, 4.5 * mm) - 3 * mm
    else:
        return wrap(c, text, tx, y, W - 2 * M - 7 * mm, 'Helvetica', 9.5, SLATE, 4.5 * mm) - 3 * mm


def page1(c):
    page_header(c, 1)
    y = H - 28 * mm

    # Title block
    c.setFillColor(GOLD)
    c.setFont('Helvetica-Bold', 8)
    c.drawString(M, y, 'FREE GUIDE — APC COUNSELLORS & SUPERVISORS')
    y -= 6 * mm
    c.setFillColor(NAVY)
    c.setFont('Helvetica-Bold', 20)
    c.drawString(M, y, 'Your formal obligations as an APC counsellor')
    y -= 8 * mm
    y = wrap(c,
        'Most counsellors were never formally trained on what the role requires. This guide covers '
        'your RICS obligations, the 2026 updates that change how you support candidates and what '
        'you should be doing at every stage of the process.',
        M, y, W - 2 * M, 'Helvetica', 10, SLATE, 5 * mm) - 4 * mm

    # Warning box
    y = warn_box(c, y,
        'When a counsellor signs a candidate\'s submission, they are formally confirming that the '
        'candidate\'s experience is genuine, the competency evidence is accurate and the candidate '
        'is ready for final assessment. That is a professional responsibility — not an administrative formality.')

    # Counsellor role
    y = section_heading(c, y, 'THE COUNSELLOR ROLE', 'What RICS actually requires')
    y = wrap(c,
        'The APC counsellor is a Chartered Surveyor who oversees a candidate\'s training and '
        'development throughout the APC process. The role is formal and carries specific obligations. '
        'A counsellor must:',
        M, y, W - 2 * M, 'Helvetica', 10, SLATE, 5 * mm) - 3 * mm

    obligations = [
        'Hold MRICS or FRICS status and be active in professional practice',
        'Meet with the candidate formally at a minimum of once every three months',
        'Review and countersign the candidate\'s diary and logbook entries',
        'Provide guidance on competency development and evidence quality',
        'Review and sign the Summary of Experience before submission',
        'Confirm the candidate\'s experience is genuine and the evidence is accurate',
        'Support the candidate in understanding what is required at each level',
    ]
    for ob in obligations:
        y = bullet(c, y, ob)

    y -= 2 * mm
    y = wrap(c,
        'The supervisor role is distinct — the supervisor oversees the day-to-day work of the candidate '
        'and confirms that the candidate\'s work experience is genuine. Both roles may be held by the same '
        'person or by different people, depending on the firm\'s structure.',
        M, y, W - 2 * M, 'Helvetica', 10, SLATE, 5 * mm) - 3 * mm

    page_footer(c)


def page2(c):
    page_header(c, 2)
    y = H - 28 * mm

    y = section_heading(c, y, 'THE 2026 UPDATES', 'What counsellors must know')

    updates = [
        ('December 2025 — Competency Choice Rules',
         'RICS updated the rules governing competency selection across all 22 pathways. Counsellors must '
         'understand the four rules: core technical at Level 1 can be selected as optional at Level 2 or 3 '
         'if the pathway guide permits; core technical at Level 2 cannot be selected as optional at Level 3; '
         'in an OR list of mandatory competencies, the candidate can only select one to a higher level; '
         'when selecting from a full competency list, the candidate cannot select a mandatory competency '
         'already counted toward the mandatory set unless specifically permitted. Review your candidate\'s '
         'proposed competency choices against the December 2025 pathway guide before submission.'),
        ('June 2025 — AI Ban on Submissions',
         'RICS introduced a formal ban on the use of AI to write or substantially generate APC submission '
         'content from June 2025. All submissions are now processed through Turnitin. As counsellor, you '
         'must be satisfied that the Summary of Experience and case study are written in the candidate\'s '
         'own words. If you have concerns, address them before countersigning.'),
        ('January 2026 — Five Attempt Limit',
         'From January 2026 RICS introduced a five-attempt limit for the final assessment. This changes '
         'the stakes of a referral — counsellors need to understand what that means for how they support '
         'candidates. A candidate who is referred once has at least four more opportunities — but each one '
         'must count. Supporting a candidate who is not ready to submit costs them an attempt they cannot recover.'),
        ('2026 — Logbook Now Mandatory',
         'The APC logbook is a separate document from the diary and must now be submitted alongside the '
         'Summary of Experience. Many candidates — and some counsellors — are unaware that the logbook is '
         'a distinct submission requirement. Check that your candidate has maintained a logbook throughout '
         'their training period, not just a diary.'),
    ]
    for label, text in updates:
        y = update_card(c, y, label, text)

    page_footer(c)


def page3(c):
    page_header(c, 3)
    y = H - 28 * mm

    y = section_heading(c, y, 'COMMON COUNSELLOR FAILURES',
                         'The most common causes of referral traceable to counsellor support')

    failures = [
        ('Countersigning without reading the SoE',
         'the counsellor signs, the candidate submits, the assessors find the evidence is Level 1 '
         'throughout when Level 2 is required'),
        ('Not challenging weak diary entries',
         'diary entries that describe tasks rather than evidence competency development are a signal '
         'the SoE will have the same problem'),
        ('Allowing an invalid competency choice',
         'the December 2025 rules catch many submissions that would previously have passed the administrative check'),
        ('Unclear on what Level 3 requires',
         'many counsellors have been qualified for years and may not have kept pace with what assessors '
         'now expect at Level 3 on technical competencies'),
        ('Supporting a candidate who is not ready',
         'the pressure of assessment windows can lead to candidates submitting before they are properly '
         'prepared. A counsellor who pushes back on this serves the candidate better than one who simply agrees'),
    ]
    for bold, body in failures:
        c.setFillColor(GOLD)
        c.circle(M + 2 * mm, y + 1.5 * mm, 1.5 * mm, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont('Helvetica-Bold', 9.5)
        c.drawString(M + 7 * mm, y, bold + ' —')
        y -= 5 * mm
        y = wrap(c, body, M + 7 * mm, y, W - 2 * M - 7 * mm, 'Helvetica', 9.5, SLATE, 4.5 * mm) - 3 * mm

    y -= 4 * mm
    y = section_heading(c, y, 'WHAT GOOD LOOKS LIKE', 'What good counsellor support looks like in practice')
    y = wrap(c,
        'The candidates who pass first time consistently have one thing in common: a counsellor who was '
        'genuinely engaged with their development, not just administering a process.',
        M, y, W - 2 * M, 'Helvetica', 10, SLATE, 5 * mm) - 3 * mm
    y = wrap(c,
        'Practically this means: quarterly meetings with a prepared agenda, not informal catch-ups; '
        'asking the candidate to present a competency answer verbally to you before submission; '
        'reading the SoE before the day before the deadline; knowing the current RICS pathway guide '
        'for your candidate\'s pathway; and being willing to say "this is not ready yet" when it is not.',
        M, y, W - 2 * M, 'Helvetica', 10, SLATE, 5 * mm) - 6 * mm

    y = green_box(c, y,
        'The platform provides 12 structured modules covering all 11 mandatory competencies, a practice '
        'mock interview simulator and Michael — an AI tutor available 24 hours a day. Candidates who use '
        'the platform alongside strong counsellor support are significantly better prepared than those '
        'relying on either alone. If your firm has multiple APC candidates, contact us about group access.')

    page_footer(c)


def main():
    out = '/Users/angelahillaire-hutchinson/Documents/getcharteredai/public/counsellor-guide.pdf'
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle('Get Chartered AI — APC Counsellor & Supervisor Guide 2026')
    c.setAuthor('Get Chartered AI')
    c.setSubject('APC Counsellor Guide 2026')
    page1(c)
    c.showPage()
    page2(c)
    c.showPage()
    page3(c)
    c.save()
    print(f'Generated: {out}')


if __name__ == '__main__':
    main()
