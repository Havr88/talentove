import { describe, expect, it } from 'vitest';
import { basicHtmlSanity, escapeHtml } from './html-sanity.js';

describe('HTML Sanity & Security Suite (Invio adaptation)', () => {
  it('permite HTML seguro y válido para plantillas', () => {
    const safeHtml = '<div class="header"><h1>Recibo de Pago</h1><p>V-12345678</p></div>';
    expect(() => basicHtmlSanity(safeHtml)).not.toThrow();
  });

  it('bloquea scripts ejecutables y elementos no seguros', () => {
    expect(() => basicHtmlSanity('<div><script>alert(1)</script></div>')).toThrow(
      'Contenido HTML no seguro detectado'
    );
    expect(() => basicHtmlSanity('<iframe src="https://evil.com"></iframe>')).toThrow(
      'Contenido HTML no seguro detectado'
    );
    expect(() => basicHtmlSanity('<img src="x" onerror="stealCookies()">')).toThrow(
      'Contenido HTML no seguro detectado'
    );
  });

  it('escapa caracteres especiales correctamente', () => {
    const escaped = escapeHtml('<script>alert("x & y")</script>');
    expect(escaped).toBe('&lt;script&gt;alert(&quot;x &amp; y&quot;)&lt;/script&gt;');
  });
});
