
// GENERATED - DO NOT MODIFY UNLESS YOU KNOW WHAT YOU ARE DOING
//             THEN HAVE FUN BUT JUST KNOW YOU CAN TOTALLY BREAK
//             THINGS. :)
import { dataprompt } from 'dataprompt';

const store = await dataprompt()

// Export flows with names matching their routes
export const flowExports = store.flows.list().reduce((acc, flow, index) => {
  acc[flow.name || `flow${index}`] = flow;
  return acc;
}, {});
