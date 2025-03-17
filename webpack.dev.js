import { merge } from 'webpack-merge';
import { entry, output, resolve, module } from './webpack.common.js';

export default merge({ entry, output, resolve, module  }, {
  mode: 'development',
  devtool: 'inline-source-map',
  optimization: {
    minimize: false,
  }
});
