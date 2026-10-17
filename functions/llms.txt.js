import { getPublicContent, originFor, realProjects, projectPath } from './_lib/seo.js';
export async function onRequestGet({ request, env }) {
  const { data } = await getPublicContent(env);
  const root = originFor(request, env);
  const name = String(data.profile?.name || 'Kawalpreet Kaur Kalsi').replace(/[\r\n]/g, ' ');
  const lines = [`# ${name}`, '', 'Creator portfolio. Information below is self-described and should be verified with the creator.', '', `Website: ${root}/`, '', '## Services', ...(data.services || []).filter(x => x.title).map(x => `- ${String(x.title).replace(/[\r\n]/g, ' ')}: ${String(x.description || '').replace(/[\r\n]/g, ' ')}`), '', '## Published projects', ...realProjects(data).map(x => `- ${String(x.title).replace(/[\r\n]/g, ' ')}: ${root}${projectPath(x)}`), '', '## Contact', `${root}/#contact`];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, s-maxage=300' } });
}
