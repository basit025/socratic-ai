/** Courses built from the team's own lecture material, one pack per course. */
import type { CoursePack } from "./kit.js";
import { compilers } from "./compilers.js";
import { dataMining } from "./dataMining.js";
import { dsa } from "./dsa.js";
import { hci } from "./hci.js";
import { isr } from "./isr.js";
import { nlp } from "./nlp.js";
import { oop } from "./oop.js";

export const coursePacks: CoursePack[] = [dsa, oop, dataMining, isr, hci, nlp, compilers];
