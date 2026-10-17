import { renderPublicHtml } from '../_lib/seo.js';
export const onRequestGet = (context) => renderPublicHtml(context, { id: context.params.id });
