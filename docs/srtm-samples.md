# Altitud y pendiente reales (SRTM) para la zona piloto

`data/samples/srtm-eje-cafetero.json` guarda la altitud y la pendiente de los 5 puntos piloto del Eje Cafetero, leídas del ráster NASA SRTMGL1 versión 003. Valen para el **punto**, no para todo el lote: la app usa la muestra más cercana dentro de ±0,08° (unos 9 km) y lo dice en la evidencia y en los vacíos de información. Este documento explica cómo regenerarlas.

## Qué tiles hacen falta

| Tile | Cubre (lat, lon) | Puntos |
| --- | --- | --- |
| `N04W076` | 4° a 5° N, 76° a 75° O | Pereira, Cerritos, Santa Rosa de Cabal, Armenia |
| `N05W076` | 5° a 6° N, 76° a 75° O | Manizales |

Son dos archivos de ~17 MB (SRTMGL1 versión 003, 1 arco-segundo ≈ 30 m).

## Paso a paso (producto oficial NASA)

1. Crea una cuenta gratuita en <https://urs.earthdata.nasa.gov/> (NASA Earthdata Login). La cuenta es personal: no se comparte ni se guarda en el repo.
2. Con la sesión iniciada, descarga los dos zip desde LP DAAC. Enlaces tomados del catálogo público de NASA (CMR):
   - <https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/SRTMGL1.003/N04W076.SRTMGL1.hgt/N04W076.SRTMGL1.hgt.zip>
   - <https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/SRTMGL1.003/N05W076.SRTMGL1.hgt/N05W076.SRTMGL1.hgt.zip>

   Si un enlace no abre, busca `SRTMGL1` versión 003 en <https://search.earthdata.nasa.gov/> y baja esos dos tiles.
3. Descomprime en una carpeta **fuera del repo** (los tiles no se commitean). El script espera archivos llamados `N04W076.hgt` y `N05W076.hgt`; si el zip trae otro nombre, renómbralos así. También acepta `.hgt.gz`.
4. Regenera el JSON:

   ```bash
   node scripts/build-srtm-samples.mjs ~/srtm-tiles --source=lpdaac
   ```

   Requiere Node 22.18 o superior. El script imprime la altitud y la pendiente de antes y de después de cada punto.
5. Revisa `git diff data/samples/srtm-eje-cafetero.json`, corre `npm run typecheck`, `npm run lint` y `npm test`, y commitea el JSON.

## Cómo se calcula cada valor

- **Altitud:** promedio de una ventana de 7×7 celdas (~210 m) alrededor del punto, sin contar vacíos de SRTM.
- **Pendiente:** promedio del método de Horn en esa misma ventana, en % (metros de desnivel por cada 100 m).
- Es el valor del **punto**, no de todo el lote: una finca de otro tamaño o en otra ladera puede diferir.

## Alternativa sin cuenta (no oficial)

Los tiles públicos de AWS (`https://elevation-tiles-prod.s3.amazonaws.com/skadi/N04/N04W076.hgt.gz`, `.../N05/N05W076.hgt.gz`) se pueden bajar sin cuenta. Según la documentación de Mapzen/Tilezen se arman con SRTM y se rellenan con GMTED y ETOPO1, así que **no son el producto oficial**. Si se usan, hay que correr el script con `--source=aws` para que la nota de fuente lo diga.
