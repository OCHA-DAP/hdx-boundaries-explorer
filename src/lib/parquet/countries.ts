import { asyncBufferFromUrl, parquetRead } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { parquetUrl } from './url';

export interface Country {
  iso3: string;
  name: string;
}

let countriesPromise: Promise<Country[]> | null = null;

export function getCountries(): Promise<Country[]> {
  if (!countriesPromise) {
    countriesPromise = (async () => {
      const asyncBuffer = await asyncBufferFromUrl({ url: parquetUrl('m49') });
      return new Promise<Country[]>((resolve) => {
        parquetRead({
          file: asyncBuffer,
          columns: ['ISO-alpha3 Code', 'Country or Area'],
          compressors,
          rowFormat: 'object',
          onComplete(rows) {
            const countries = (
              rows as Array<{ 'ISO-alpha3 Code': string; 'Country or Area': string }>
            )
              .filter((r) => r['ISO-alpha3 Code'] && r['Country or Area'])
              .map((r) => ({ iso3: r['ISO-alpha3 Code'], name: r['Country or Area'] }))
              .sort((a, b) => a.name.localeCompare(b.name));
            resolve(countries);
          },
        });
      });
    })();
  }
  return countriesPromise;
}
