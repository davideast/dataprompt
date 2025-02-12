import Handlebars from 'handlebars'

export function processTemplates(
  handlebars: typeof Handlebars,
  config: any,
  context: Record<string, any>
): any {
  if (typeof config === 'string') {
    return handlebars.compile(config)(context);
  }
  
  // For array of strings/tuples or objects, process each value
  return JSON.parse(
    handlebars.compile(JSON.stringify(config))(context)
  );
}
