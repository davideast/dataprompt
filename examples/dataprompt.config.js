/*
  This file is not needed if you only want the default values.
  export a DatapromptConfig object

  import type { DatapromptConfig } from 'dataprompt'
*/
import { fsPlugin } from 'dataprompt/plugins/fs'

export default {
  promptsDir: 'prompts',
  plugins: [
    fsPlugin()
  ]
}
