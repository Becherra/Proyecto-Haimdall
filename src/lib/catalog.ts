import { z } from "zod";
import cropsData from "../../data/crops.json";
import { cropSchema, type Crop } from "../types";

/** Catálogo de cultivos validado al cargar el módulo: un `crops.json` roto falla aquí y no a mitad del análisis. */
export const CROPS: readonly Crop[] = z.array(cropSchema).parse(cropsData);
