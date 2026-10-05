import asyncio
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '.audio-tools'))
import edge_tts

ROOT = Path(__file__).resolve().parent
WORDS = json.loads((ROOT / 'audio-words.json').read_text(encoding='utf-8'))

async def main():
    semaphore = asyncio.Semaphore(3)
    async def generate(index, word):
        output = ROOT / 'dist' / 'audio' / f'word-{index + 1}.mp3'
        async with semaphore:
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(word, 'mr-IN-AarohiNeural', rate='-20%').save(str(output))
                    if output.stat().st_size < 1000:
                        raise RuntimeError('Empty audio')
                    print(f'Generated pronunciation {index + 1}/{len(WORDS)}', flush=True)
                    return
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1)
    await asyncio.gather(*(generate(i, word) for i, word in enumerate(WORDS)))

asyncio.run(main())
