// Quick test for the URL validation fix
import { parseHivePostUrl } from './utils/extractHivePostInfo';

const testUrl = 'https://peakd.com/hive-181335/@coldbeetrootsoup/lnsxfxjf';
const result = parseHivePostUrl(testUrl);

console.log('Test URL:', testUrl);
console.log('Parse result:', result);
console.log('Expected:', { author: 'coldbeetrootsoup', permlink: 'lnsxfxjf' });
console.log('Success:', result && result.author === 'coldbeetrootsoup' && result.permlink === 'lnsxfxjf');
