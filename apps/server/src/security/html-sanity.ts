/**
 * Sanitizador de contenido HTML inspirado en Invio (basicHtmlSanity).
 * Bloquea etiquetas ejecutables y contenedores de inserción maliciosa (XSS)
 * en plantillas y membretes personalizados.
 */
export function basicHtmlSanity(html: string): void {
  const lower = html.toLowerCase();
  const bannedTags = [
    '<script',
    '</script>',
    '<iframe',
    '<object',
    '<embed',
    'javascript:',
    'onload=',
    'onerror=',
  ];

  for (const tag of bannedTags) {
    if (lower.includes(tag)) {
      throw new Error(`Contenido HTML no seguro detectado: etiqueta o atributo prohibido "${tag}".`);
    }
  }
}

/**
 * Escapa caracteres HTML especiales para evitar inyecciones.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
