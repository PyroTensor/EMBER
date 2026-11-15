import { env } from "@/lib/config/env";
import type { DocumentSummary } from "@/lib/api/types";

export interface PsiPublication {
  readonly title: string;
  readonly authors: string;
  readonly url: string;
  readonly psiCodes: readonly string[];
}

export const PSI_PUBLICATIONS: readonly PsiPublication[] = [
  {
    "title": "A Mechanistic Study of Soret Diffusion in Hydrogen-Air Flames",
    "authors": "Yang Fan, Law C.K., Sung C.J., Zhang Huiqiang",
    "url": "https://doi.org/10.2514/6.2009-988",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "A Burke-Schumann analysis of dual-flame structure supported by a burning droplet",
    "authors": "Nayagam Vedha, Dietrich Daniel L., Williams Forman A.",
    "url": "https://doi.org/10.1016/j.icheatmasstransfer.2017.06.016",
    "psiCodes": [
      "PSI-68"
    ]
  },
  {
    "title": "A Burke–Schumann analysis of diffusion-flame structures supported by a burning droplet",
    "authors": "Nayagam Vedha, Dietrich Daniel L., Williams Forman A.",
    "url": "https://doi.org/10.1080/13647830.2017.1280182",
    "psiCodes": [
      "PSI-68"
    ]
  },
  {
    "title": "A Burning Rate Emulator (BRE) for study of condensed fuel burning in microgravity",
    "authors": "Markan Akshit, Sunderland Peter B., Quintiere James G., de Ris John L., Stocker Dennis P., Baum Howard R.",
    "url": "https://doi.org/10.1016/j.combustflame.2018.01.044",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "A Combined Experimental and Computational Study of Soot Formation in Normal and Microgravity Conditions",
    "authors": "Dobbins Richard R., Tinjero Jesse, Squeo Joseph, Zhao Xinyu, Hall Robert J., Colket Meredith B., Long Marshall B., Smooke Mitchell D.",
    "url": "https://doi.org/10.1080/00102202.2022.2041621",
    "psiCodes": [
      "PSI-21",
      "PSI-60",
      "PSI-106",
      "PSI-107"
    ]
  },
  {
    "title": "A comparison of Raman signatures and laser-induced incandescence with direct numerical simulation of soot growth in non-premixed ethylene/air flames",
    "authors": "Herdman Jennifer D., Connelly Blair C., Smooke Mitchell D., Long Marshall B., Miller J. Houston",
    "url": "https://doi.org/10.1016/j.carbon.2011.07.050",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "A comparison of the spherical flame characteristics of sub-millimeter droplets of binary mixtures of n-heptane/iso-octane and n-heptane/toluene with a commercial unleaded gasoline",
    "authors": "Liu Yu Cheng, Avedisian C. Thomas",
    "url": "https://doi.org/10.1016/j.combustflame.2011.08.015",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "A computational and experimental study of coflow laminar methane/air diffusion flames: Effects of fuel dilution, inlet velocity, and gravity",
    "authors": "Cao S., Ma B., Bennett B.A.V., Giassi D., Stocker D.P., Takahashi F., Long M.B., Smooke M.D.",
    "url": "https://doi.org/10.1016/j.proci.2014.05.138",
    "psiCodes": [
      "PSI-21",
      "PSI-106"
    ]
  },
  {
    "title": "A Correlation for an Effective Flow Velocity for Capturing the Boundary Layer Effect in Opposed-Flow Flame Spread over Thin Fuels",
    "authors": "S Bhattacharjee, R Nagarkar, Y Nakamura",
    "url": "https://doi.org/10.1080/00102202.2014.900056",
    "psiCodes": [
      "PSI-26"
    ]
  },
  {
    "title": "A Gas Burner to Emulate Condensed-Phase Burning",
    "authors": "Zhang Y., Bustamante M. J., Dotson K. T., Sunderland P. B., Quintiere J. G.",
    "url": "https://doi.org/10.3850/978-981-07-5936-0_03-01",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "A mechanistic evaluation of Soret diffusion in heptane/air flames",
    "authors": "Xin Yuxuan, Sung Chih-Jen, Law Chung K.",
    "url": "https://doi.org/10.1016/j.combustflame.2012.03.005",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "A mechanistic study of Soret diffusion in hydrogen–air flames",
    "authors": "Yang F., Law C.K., Sung C.J., Zhang H.Q.",
    "url": "https://doi.org/10.1016/j.combustflame.2009.09.018",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "A new method of flame temperature measurement utilizing the acoustic emissions from laser-induced plasmas",
    "authors": "Wu Wendong, Adeosun Adewale, Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.proci.2018.07.096",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "A novel apparatus for flame spread study",
    "authors": "S Bhattacharjee, M Bundy, C Paolini, G Patel, W Tran.",
    "url": "https://doi.org/10.1016/j.proci.2012.05.076",
    "psiCodes": [
      "PSI-26"
    ]
  },
  {
    "title": "A Numerical Study On The Extinction Characteristics Of Droplet Combustion Under Microgravity Conditions",
    "authors": "Farouk Tanvir, Dryer Frederick",
    "url": "https://doi.org/10.2514/6.2012-1252",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "A paradigm shift in the interaction of experiments and computations in combustion research",
    "authors": "Connelly B.C., Bennett B.A.V., Smooke M.D., Long M.B.",
    "url": "https://doi.org/10.1016/j.proci.2008.05.066",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "A Research Plan for Fire Prevention, Detection and Suppression in Crewed Exploration Systems",
    "authors": "Ruff Gary, Urban David, King Merrill",
    "url": "https://doi.org/10.2514/6.2005-341",
    "psiCodes": [
      "PSI-47",
      "PSI-102"
    ]
  },
  {
    "title": "A short mechanism for the low-temperature ignition of n-heptane at high pressures",
    "authors": "Prince Juan C., Williams Forman A., Ovando Guillermo E.",
    "url": "https://doi.org/10.1016/j.fuel.2014.08.063",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "A Study of the Effectiveness of a Narrow Channel Apparatus in Simulating Microgravity Flame Spread over Thin Fuels",
    "authors": "Pepper Jacob, Miller Fletcher, Olson Sandra, Wichman Indrek",
    "url": "https://doi.org/10.2514/6.2012-3493",
    "psiCodes": [
      "PSI-25"
    ]
  },
  {
    "title": "A theoretical study on soot inception in spherical burner-stabilized diffusion flames",
    "authors": "Liu S., Chao B.H., Axelbaum R.L.",
    "url": "https://doi.org/10.1016/j.combustflame.2004.08.016",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Absolute light calibration using S-type thermocouples",
    "authors": "Ma Bin, Long Marshall B.",
    "url": "https://doi.org/10.1016/j.proci.2012.05.030",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Activation energy asymptotics for methanol droplet extinction in microgravity",
    "authors": "Nayagam Vedha",
    "url": "https://doi.org/10.1016/j.combustflame.2013.05.011",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "An Approach to Thermocouple Measurements That Reduces Uncertainties in High-Temperature Environments",
    "authors": "Krishnan Siddharth, Kumfer Benjamin M., Wu Wendong, Li Jichuan, Nehorai Arye, Axelbaum Richard L.",
    "url": "https://doi.org/10.1021/acs.energyfuels.5b00071",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "An experimental and computational study of soot formation in a coflow jet flame under microgravity and normal gravity",
    "authors": "Ma Bin, Cao Su, Giassi Davide, Stocker Dennis P., Takahashi Fumiaki, Bennett Beth Anne V., Smooke Mitchell D., Long Marshall B.",
    "url": "https://doi.org/10.1016/j.proci.2014.05.064",
    "psiCodes": [
      "PSI-21",
      "PSI-106"
    ]
  },
  {
    "title": "An experimental investigation on self-acceleration of cellular spherical flames",
    "authors": "Wu Fujia, Jomaas Grunde, Law Chung K.",
    "url": "https://doi.org/10.1016/j.proci.2012.05.068",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "An Experimental Study on the Response of Spherical Diffusion Flames Subjected to Rotation and Nonequidiffusion",
    "authors": "Zhu Delin, Yoo Sean, Law C, Sacksteder Kurt",
    "url": "https://doi.org/10.2514/6.2005-1141",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "An investigation of thermal radiation from laminar diffusion flames in a tri-coflow burner with central oxygen",
    "authors": "Irace P.H., Gopan A., Axelbaum R.L.",
    "url": "https://doi.org/10.1016/j.combustflame.2022.112158",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Analysis of CH* concentration and flame heat release rate in laminar coflow diffusion flames under microgravity and normal gravity",
    "authors": "D Giassi, S Cao, BA Bennett, DP Stocker, F Takahashi, MD Smooke, MB Long",
    "url": "https://doi.org/10.1016/j.combustflame.2016.02.012",
    "psiCodes": [
      "PSI-21",
      "PSI-106"
    ]
  },
  {
    "title": "Analysis of extinction and sustained ignition",
    "authors": "Vermina Plathner Frida, Quintiere James G., van Hees Patrick",
    "url": "https://doi.org/10.1016/j.firesaf.2019.02.003",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Analysis of the melt phase of a rotating polymer disc supporting a diffusion flame",
    "authors": "Nayagam Vedha, Williams F. A.",
    "url": "https://doi.org/10.1017/jfm.2011.349",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "Asymptotic analysis of quasi-steady n-heptane droplet combustion supported by cool-flame chemistry",
    "authors": "Seshadri Kalyanasundaram, Peters Norbert, Williams Forman A., Nayagam Vedha, Paczko Guenter",
    "url": "https://doi.org/10.1080/13647830.2016.1248494",
    "psiCodes": [
      "PSI-39",
      "PSI-69"
    ]
  },
  {
    "title": "AUTOMATED DATA ANALYSIS FOR CONSECUTIVE IMAGES FROM DROPLET COMBUSTION EXPERIMENTS",
    "authors": "Dembia Christopher Lee, Liu Yu Cheng, Avedisian C. Thomas",
    "url": "https://doi.org/10.5566/ias.v31.p137-148",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Behavior of a small diffusion flame as an electrically active component in a high-voltage circuit",
    "authors": "Borgatelli Francesco, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.combustflame.2011.06.002",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Binary collision of a burning droplet and a non-burning droplet of xylene: Outcome regimes and flame dynamics",
    "authors": "Xiong Gang, Gandhi Rahul, Zhong Xiaosheng, Mädler Lutz, Tse Stephen D.",
    "url": "https://doi.org/10.1016/j.proci.2018.06.198",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Buoyancy effects on concurrent flame spread over thick PMMA",
    "authors": "Thomsen Maria, Fernandez-Pello Carlos, Ruff Gary A., Urban David L.",
    "url": "https://doi.org/10.1016/j.combustflame.2018.10.016",
    "psiCodes": [
      "PSI-99"
    ]
  },
  {
    "title": "Burning in microgravity: Experimental results and analysis",
    "authors": "P Dehghani, PB Sunderland, JG Quintiere, JL deRis",
    "url": "https://doi.org/10.1016/j.combustflame.2021.01.035",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Burning on flat wicks at various orientations",
    "authors": "Zhang Yi, Bustamante Michael J, Gollner Michael J, Sunderland Peter B, Quintiere James G",
    "url": "https://doi.org/10.1177/0734904113495650",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Can cool flames support quasi-steady alkane droplet burning?",
    "authors": "V Nayagam, DL Dietrich, PV Ferkul, MC Hicks, FA Williams",
    "url": "https://doi.org/10.1016/j.combustflame.2012.07.012",
    "psiCodes": [
      "PSI-39",
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Canceling buoyancy of gaseous fuel flames in a gravitational environment using an ion-driven wind.",
    "authors": "Papac MJ, Dunn-Rankin D.",
    "url": "https://doi.org/10.1196/annals.1362.038",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Characteristics of non-premixed oxygen-enhanced combustion: I. The presence of appreciable oxygen at the location of maximum temperature",
    "authors": "Skeen S.A., Yablonsky G., Axelbaum R.L.",
    "url": "https://doi.org/10.1016/j.combustflame.2009.07.009",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Characteristics of non-premixed oxygen-enhanced combustion: II. Flame structure effects on soot precursor kinetics resulting in soot-free flames",
    "authors": "Skeen S.A., Yablonsky G., Axelbaum R.L.",
    "url": "https://doi.org/10.1016/j.combustflame.2010.04.013",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Characterization of Nuisance Particulates in the ISS: Space Smoke Aerosols and Lunar Dust Abatement",
    "authors": "Bryg VM, Yuan Z-G, Urban DL, Ruff G, Mulholland G, Agui J",
    "url": "https://doi.org/10.1017/S1431927610060563",
    "psiCodes": [
      "PSI-102"
    ]
  },
  {
    "title": "Characterizing I-V Curves for Non-Premixed Methane Flames Stabilized on Different Burner Configurations",
    "authors": "Tinajero Jesse, Bernard Guillaume, Autef Louise, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1080/00102202.2017.1331218",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Chemiluminescent OH* and CH* flame structure and aerodynamic scaling of weakly buoyant, nearly spherical diffusion flames",
    "authors": "Yoo S.W., Law C.K., Tse S.D.",
    "url": "https://doi.org/10.1016/S1540-7489(02)80204-8",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "CO emission from an impinging non-premixed flame",
    "authors": "Chien Yu-Chien, Escofet-Martin David, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.combustflame.2016.09.004",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Combustion of Butanol, Gasoline, and Butanol/Gasoline Mixture Droplets",
    "authors": "Xu Yuhao, Avedisian C. Thomas",
    "url": "https://doi.org/10.1021/acs.energyfuels.5b00158",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Combustion of Methanol Droplets in Air-Diluent Environments with Reduced and Normal Gravity",
    "authors": "Shaw Benjamin, Wei Jingbin",
    "url": "https://doi.org/10.1155/2012/587987",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Combustion of Submillimeter Heptane/Methanol and Heptane/Ethanol Droplets in Reduced Gravity",
    "authors": "Aharon I., Tam V. K., Shaw B. D.",
    "url": "https://doi.org/10.1155/2013/154202",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Comparison of the Burning Characteristics of Indolene and Commercial Grade Gasoline Droplets without Convection",
    "authors": "Liu Yu Cheng, Savas Anthony J., Avedisian C. Thomas",
    "url": "https://doi.org/10.1021/ef3007849",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Computational and experimental investigation of the interaction of soot and NO in coflow diffusion flames",
    "authors": "Connelly B.C., Long M.B., Smooke M.D., Hall R.J., Colket M.B.",
    "url": "https://doi.org/10.1016/j.proci.2008.06.182",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Computational and experimental study of a forced, time-dependent, methane–air coflow diffusion flame",
    "authors": "Dworkin S.B., Connelly B.C., Schaffer A.M., Bennett B.A.V., Long M.B., Smooke M.D., Puccio M.P., McAndrews B., Miller J.H.",
    "url": "https://doi.org/10.1016/j.proci.2006.08.109",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Computational modeling of n-heptane droplet combustion in air–diluent environments under reduced-gravity",
    "authors": "Jin Y., Shaw B.D.",
    "url": "https://doi.org/10.1016/j.ijheatmasstransfer.2010.08.005",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Computational Modeling of Unsupported and Fiber-Supported n-Heptane Droplet Combustion in Reduced Gravity: A Study of Fiber Effects",
    "authors": "Ghata Narugopal, Shaw Benjamin D.",
    "url": "https://doi.org/10.1080/00102202.2014.971950",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Concurrent flame growth, spread, and quenching over composite fabric samples in low speed purely forced flow in microgravity",
    "authors": "Zhao Xiaoyang, Liao Ya-Ting T., Johnston Michael C., T'ien James S., Ferkul Paul V., Olson Sandra L.",
    "url": "https://doi.org/10.1016/j.proci.2016.06.028",
    "psiCodes": [
      "PSI-25"
    ]
  },
  {
    "title": "Concurrent Flame Spread Over Two-Sided Thick PMMA Slabs in Microgravity",
    "authors": "Olson Sandra L., Urban David L., Ruff Gary A., Ferkul Paul V., Toth Balazs, Eigenbrod Christian, Meyer Florian, Jomaas Grunde",
    "url": "https://doi.org/10.1007/s10694-019-00863-3",
    "psiCodes": [
      "PSI-99"
    ]
  },
  {
    "title": "Constrained-temperature solutions of coflow laminar diffusion flames",
    "authors": "Kempema Nathan J., Dobbins Richard R., Long Marshall B., Smooke Mitchell D.",
    "url": "https://doi.org/10.1016/j.proci.2020.06.034",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Cool diffusion flames in a stably stratified stagnation flow",
    "authors": "Waddell Kendyl A., Lee Han Ju, Nayagam Vedha, Axelbaum Richard L., Sunderland Peter B.",
    "url": "https://doi.org/10.1016/j.combustflame.2023.112852",
    "psiCodes": [
      "PSI-159"
    ]
  },
  {
    "title": "Cool-flame dodecane-droplet extinction diameters",
    "authors": "Williams Forman A., Nayagam Vedha",
    "url": "https://doi.org/10.1016/j.combustflame.2019.10.036",
    "psiCodes": [
      "PSI-68"
    ]
  },
  {
    "title": "Cool-flame extinction during n-alkane droplet combustion in microgravity",
    "authors": "V Nayagam, DL Dietrich, MC Hicks, FA Williams",
    "url": "https://doi.org/10.1016/j.combustflame.2015.01.012",
    "psiCodes": [
      "PSI-39",
      "PSI-69"
    ]
  },
  {
    "title": "Counterflow flame experiments and chemical kinetic modeling of dimethyl ether/methane mixtures",
    "authors": "Reuter Christopher B., Zhang Rui, Yehia Omar R., Rezgui Yacine, Ju Yiguang",
    "url": "https://doi.org/10.1016/j.combustflame.2018.06.004",
    "psiCodes": [
      "PSI-142"
    ]
  },
  {
    "title": "Critical temperature and reactant mass flux for radiative extinction of ethylene microgravity spherical diffusion flames at 1 bar",
    "authors": "Irace Phillip H., Waddell Kendyl A., Constales Denis, Sunderland Peter B., Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.proci.2022.07.043",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Demonstrating steady burning for small flat materials in microgravity in a quiescent ambient",
    "authors": "Dehghani Parham, de Ris John L., Quintiere James G.",
    "url": "https://doi.org/10.1016/j.proci.2022.08.107",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Detailed characterization of DC electric field effects on small non-premixed flames",
    "authors": "Karnani Sunny, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.combustflame.2015.03.019",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Detection of Smoke from Microgravity Fires",
    "authors": "Urban David, Griffin DeVon, Ruff Gary, Cleary Thomas, Yang Jiann, Mulholland George, Yuan Zeng-guang",
    "url": "https://doi.org/10.4271/2005-01-2930",
    "psiCodes": [
      "PSI-47"
    ]
  },
  {
    "title": "Developing Surrogates for Liquid Transportation Fuels: The Role of Spherically Symmetric Droplet Combustion",
    "authors": "Avedisian C. Thomas",
    "url": "https://doi.org/10.1007/978-81-322-2211-8_16",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Development of Comprehensive Detailed and Reduced Reaction Mechanisms for Combustion Modeling",
    "authors": "Law C. K., Sung C. J., Wang H., Lu T. F.",
    "url": "https://doi.org/10.2514/2.7289",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Dilution effects on laminar jet diffusion flame lengths",
    "authors": "Wang Zhengyang, Sunderland Peter B., Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.proci.2018.06.085",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Direct Numerical Simulation of turbulent nonpremixed “cool” flames: Applicability of flamelet models",
    "authors": "Novoselov Alex G., Law Chung K., Mueller Michael E.",
    "url": "https://doi.org/10.1016/j.proci.2018.06.191",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Distributed-memory parallel computation of a forced, time-dependent, sooting, ethylene/air coflow diffusion flame",
    "authors": "Dworkin S. B., Cooke J. A., Bennett B. A.V., Connelly B. C., Long M. B., Smooke M. D., Hall R. J., Colket M. B.",
    "url": "https://doi.org/10.1080/13647830903159293",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Double blue zones in inverse and normal laminar jet diffusion flames",
    "authors": "Wang Zhengyang, Sunderland Peter B., Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.combustflame.2019.09.014",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Droplet Combustion Experiments Aboard the International Space Station",
    "authors": "Dietrich Daniel L., Nayagam Vedha, Hicks Michael C., Ferkul Paul V., Dryer Frederick L., Farouk Tanvir, Shaw Benjamin D., Suh Hyun Kyu, Choi Mun Y., Liu Yu Cheng, Avedisian C. Thomas, Williams Forman A.",
    "url": "https://doi.org/10.1007/s12217-014-9372-2",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Dynamics and burning limits of near-limit hot, warm, and cool diffusion flames of dimethyl ether at elevated pressures",
    "authors": "Lin Eric, Reuter Christopher B., Ju Yiguang",
    "url": "https://doi.org/10.1016/j.proci.2018.05.082",
    "psiCodes": [
      "PSI-142"
    ]
  },
  {
    "title": "Dynamics and morphology of spherical diffusion flames under rotation",
    "authors": "S Yoo, S Chaudhuri, K Sacksteder, P Zhang, D Zhu, C Law",
    "url": "https://doi.org/10.2514/6.2012-1251",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Dynamics of cool flames (2019)",
    "authors": "Ju Yiguang, Reuter Christopher B., Yehia Omar R., Farouk Tanvir I., Won Sang Hee",
    "url": "https://doi.org/10.1016/j.pecs.2019.100787",
    "psiCodes": [
      "PSI-117",
      "PSI-142"
    ]
  },
  {
    "title": "Effect of soot self-absorption on color-ratio pyrometry in laminar coflow diffusion flames",
    "authors": "Kempema Nathan J., Long Marshall B.",
    "url": "https://doi.org/10.1364/OL.43.001103",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Effects of Inert Placement (Z st) on Soot and Radiative Heat Flux in Turbulent Diffusion Flames",
    "authors": "Gopan Akshay, Yang Zhiwei, Kumfer Benjamin M., Axelbaum Richard L.",
    "url": "https://doi.org/10.1021/acs.energyfuels.7b01092",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Effects of pressure and fuel dilution on coflow laminar methane–air diffusion flames: A computational and experimental study",
    "authors": "Cao Su, Ma Bin, Giassi Davide, Bennett Beth Anne V., Long Marshall B., Smooke Mitchell D.",
    "url": "https://doi.org/10.1080/13647830.2017.1403051",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Effects of structure and hydrodynamics on the sooting behavior of spherical microgravity diffusion flames",
    "authors": "Sunderland P",
    "url": "https://doi.org/10.1016/S0010-2180(02)00424-8",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Effects of variable density on response of spherical diffusion flames under rotation",
    "authors": "Yoo S.W., Law C.K.",
    "url": "https://doi.org/10.1016/j.ijheatmasstransfer.2006.12.014",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Electric Field Induced Changes of a Diffusion Flame and Heat Transfer near an Impinging Surface",
    "authors": "Chien Yu-Chien, Dunn-Rankin Derek",
    "url": "https://doi.org/10.3390/en11051235",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Electric field-controlled mesoscale burners",
    "authors": "Weinberg Felix, Carleton Fred, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.combustflame.2007.07.007",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Electric-field effects on methane coflow flames aboard the international space station (ISS): ACME E-FIELD flames",
    "authors": "Chien Yu-Chien, Stocker Dennis P., Hegde Uday G., Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.combustflame.2022.112443",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Electrical aspects of flame quenching",
    "authors": "Weinberg F.J., Dunn-Rankin D., Carleton F.B., Karnani S., Markides C., Zhai M.",
    "url": "https://doi.org/10.1016/j.proci.2012.07.007",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Emulation of condensed fuel flames with gaseous fuels supplied through a porous copper calorimeter",
    "authors": "Auth Eric, Quintiere James G., Sunderland Peter B.",
    "url": "https://doi.org/10.1002/fam.2896",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Emulation of condensed fuel flames with gases in microgravity",
    "authors": "Zhang Yi, Kim Matt, Guo Haiqing, Sunderland Peter B., Quintiere James G., deRis John, Stocker Dennis P.",
    "url": "https://doi.org/10.1016/j.combustflame.2015.05.005",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Evaluation of gas and particle sensors for detecting spacecraft-relevant fire emissions",
    "authors": "Wang Xiaoliang, Zhou Hao, Arnott W. Patrick, Meyer Marit E., Taylor Samuel, Firouzkouhi Hatef, Moosmüller Hans, Chow Judith C., Watson John G.",
    "url": "https://doi.org/10.1016/j.firesaf.2020.102977",
    "psiCodes": [
      "PSI-99"
    ]
  },
  {
    "title": "Evaluation of spacecraft smoke detector performance in the low-gravity environment",
    "authors": "Meyer Marit E., Urban David L., Mulholland George W., Bryg Victoria, Yuan Zeng-Guang, Ruff Gary A., Cleary Thomas, Yang Jiann",
    "url": "https://doi.org/10.1016/j.firesaf.2018.04.004",
    "psiCodes": [
      "PSI-101",
      "PSI-102"
    ]
  },
  {
    "title": "Experimental Observations of the Low-Temperature Burning of Decane/Hexanol Droplets in Microgravity",
    "authors": "Dietrich D. L., Calabria R., Massoli P., Nayagam V., Williams F. A.",
    "url": "https://doi.org/10.1080/00102202.2016.1225730",
    "psiCodes": [
      "PSI-68"
    ]
  },
  {
    "title": "Experimental Study of Initial Diameter Effects on Convection-free Droplet Combustion in the Standard Atmosphere for n-Heptane, n-Octane, and n-Decane: International Space Station and Ground-based Experiments",
    "authors": "YC Liu, CT Avedisian, KN Trenou, JK Rah, MC Hicks",
    "url": "https://doi.org/10.2514/6.2014-1019",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Experimental validation of a correlation capturing the boundary layer effect on spread rate in the kinetic regime of opposed-flow flame spread",
    "authors": "Bhattacharjee Subrata, Tran Wynn, Laue Matthew, Paolini Christopher, Nakamura Yuji",
    "url": "https://doi.org/10.1016/j.proci.2014.06.125",
    "psiCodes": [
      "PSI-25"
    ]
  },
  {
    "title": "Experiments on Submillimeter Free Droplet Flame Extinction",
    "authors": "Shaw B. D., Wang D. F.",
    "url": "https://doi.org/10.1080/00102202.2012.759946",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Extended flammability limits of n-heptane/air mixtures with cool flames",
    "authors": "Liang Wenkai, Law Chung K.",
    "url": "https://doi.org/10.1016/j.combustflame.2017.06.015",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Extinction characteristics of isolated n-alkane fuel droplets during low temperature cool flame burning in air (2023)",
    "authors": "Farouk Tanvir I., Dryer Frederick L.",
    "url": "https://doi.org/10.1016/j.proci.2022.07.094",
    "psiCodes": [
      "PSI-117"
    ]
  },
  {
    "title": "Extinction mechanisms of near-limit premixed flames and extended limits of flammability",
    "authors": "Sung C.J., Law C.K.",
    "url": "https://doi.org/10.1016/S0082-0784(96)80296-7",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Extremely weak hydrogen flames",
    "authors": "Lecoustre V.R., Sunderland P.B., Chao B.H., Axelbaum R.L.",
    "url": "https://doi.org/10.1016/j.combustflame.2010.07.024",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Fire in Microgravity",
    "authors": "Hariharan Ashwin, Miller Fletcher, Olson Sandra, Wichman Indrek",
    "url": "https://doi.org/10.1511/2016.118.44",
    "psiCodes": [
      "PSI-25"
    ]
  },
  {
    "title": "Fire safety in space – beyond flammability testing of small samples",
    "authors": "Jomaas Grunde, Torero Jose L., Eigenbrod Christian, Niehaus Justin, Olson Sandra L., Ferkul Paul V., Legros Guillaume, Fernandez-Pello A. Carlos, Cowlard Adam J., Rouvreau Sebastien, Smirnov Nickolay, Fujita Osamu, T׳ien James S., Ruff Gary A., Urban David L.",
    "url": "https://doi.org/10.1016/j.actaastro.2014.11.025",
    "psiCodes": [
      "PSI-98"
    ]
  },
  {
    "title": "Flame spread: Effects of microgravity and scale",
    "authors": "Urban David L., Ferkul Paul, Olson Sandra, Ruff Gary A., Easton John, T'ien James S., Liao Ya-Ting T., Li Chengyao, Fernandez-Pello Carlos, Torero Jose L., Legros Guillaume, Eigenbrod Christian, Smirnov Nickolay, Fujita Osamu, Rouvreau Sébastien, Toth Balazs, Jomaas Grunde",
    "url": "https://doi.org/10.1016/j.combustflame.2018.10.012",
    "psiCodes": [
      "PSI-98",
      "PSI-99"
    ]
  },
  {
    "title": "Flammability maps for microgravity burning of a small flat material in a quiescent ambient",
    "authors": "Dehghani Parham, Quintiere James G.",
    "url": "https://doi.org/10.1016/j.combustflame.2023.112809",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Fuel Options for Next-Generation Chemical Propulsion",
    "authors": "Law Chung K.",
    "url": "https://doi.org/10.2514/1.J051328",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Ignition and combustion of n-heptane droplets in carbon dioxide enriched environments",
    "authors": "Dzik Justin, Nayagam Vedha, Williams Forman A.",
    "url": "https://doi.org/10.1016/j.icheatmasstransfer.2009.10.006",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "IMAGING FLAMES: FROM ADVANCED LASER DIAGNOSTICS TO SNAPSHOTS",
    "authors": "LONG MARSHALL",
    "url": "https://doi.org/10.1142/9789814295789_0004",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Impinging nonpremixed coflow methane–air flames with unity Lewis number",
    "authors": "M. Sauer Vinicius, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.proci.2016.06.193",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Inducing gas flow and swirl in tubes using ionic wind from corona discharges",
    "authors": "Weinberg Felix, Carleton Fred, Kara Dhiren, Xavier Agatha, Dunn-Rankin Derek, Rickard Matthew",
    "url": "https://doi.org/10.1007/s00348-005-0062-0",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Influence of Gravity and Ambient Pressure on Combustion and Flammability of n-Heptane and 1-Propanol Droplets in Air-Diluent Environments",
    "authors": "Shaw B. D., Wei J. B.",
    "url": "https://doi.org/10.1080/00102202.2010.498798",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Influences of support fibers on vaporizing fuel droplets",
    "authors": "Shringi D., Dwyer H.A., Shaw B.D.",
    "url": "https://doi.org/10.1016/j.compfluid.2013.02.005",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "Initial diameter effects on combustion of unsupported equi-volume n-heptane/iso-octane mixture droplets and the transition to cool flame behavior: Experimental observations and detailed numerical modeling (2020)",
    "authors": "Xu Yuhao, Farouk Tanvir I., Hicks Michael C., Avedisian C. Thomas",
    "url": "https://doi.org/10.1016/j.combustflame.2020.06.012",
    "psiCodes": [
      "PSI-117"
    ]
  },
  {
    "title": "Initiation and propagation of laminar premixed cool flames",
    "authors": "Zhao Peng, Liang Wenkai, Deng Sili, Law Chung K.",
    "url": "https://doi.org/10.1016/j.fuel.2015.11.025",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Interpretation of Backlit Droplet Images from ISS Droplet Combustion Experiments",
    "authors": "Yu Fei, Shaw Benjamin D.",
    "url": "https://doi.org/10.2478/gsr-2014-0007",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Ion current and carbon monoxide release from an impinging methane/air coflow flame in an electric field",
    "authors": "Chien Yu-Chien, Escofet-Martin David, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.combustflame.2019.03.022",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Ionization and chemiluminescence during the progressive aeration of methane flames",
    "authors": "Weinberg Felix, Carleton Fred",
    "url": "https://doi.org/10.1016/j.combustflame.2009.08.008",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Isolated n-heptane droplet combustion in microgravity: “Cool Flames” – Two-stage combustion",
    "authors": "Farouk Tanvir I., Dryer Frederick L.",
    "url": "https://doi.org/10.1016/j.combustflame.2013.09.011",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "ISS Destiny Laboratory Smoke Detection Model",
    "authors": "Brooker John E., Urban David L., Ruff Gary A.",
    "url": "https://doi.org/10.4271/2007-01-3076",
    "psiCodes": [
      "PSI-102"
    ]
  },
  {
    "title": "ISS Droplet Combustion Experiments - Uncertainties in Droplet Sizes and Burning Rates",
    "authors": "Shaw Benjamin D.",
    "url": "https://doi.org/10.1007/s12217-014-9377-x",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Kinetic and radiative extinctions of spherical burner-stabilized diffusion flames",
    "authors": "Wang Q., Chao B.H.",
    "url": "https://doi.org/10.1016/j.combustflame.2010.12.007",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Laminar Smoke Points in Coflow Measured Aboard the International Space Station",
    "authors": "Dotson Keenan, Sunderland Peter, Yuan Zeng-Guang, Urban David",
    "url": "https://doi.org/10.2514/6.2010-1105",
    "psiCodes": [
      "PSI-107"
    ]
  },
  {
    "title": "Laminar smoke points of coflowing flames in microgravity",
    "authors": "Dotson K.T., Sunderland P.B., Yuan Z.-G., Urban D.L.",
    "url": "https://doi.org/10.1016/j.firesaf.2011.08.002",
    "psiCodes": [
      "PSI-107"
    ]
  },
  {
    "title": "Laser-induced fluorescence imaging of acetone inside evaporating and burning fuel droplets",
    "authors": "Shringi D.S., Shaw B.D., Dwyer H.A.",
    "url": "https://doi.org/10.1016/j.optlaseng.2008.08.002",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "Low Temperature n-Dodecane Droplet Combustion Experiments Aboard the International Space Station",
    "authors": "Dietrich Daniel, Krause Timmothy, Nayagam Vedha, Farouk Tanvir, Dryer Frederick, Williams Forman",
    "url": "https://doi.org/10.1007/s12217-024-10115-x",
    "psiCodes": [
      "PSI-39"
    ]
  },
  {
    "title": "Low-temperature multistage warm diffusion flames",
    "authors": "Yehia Omar R., Reuter Christopher B., Ju Yiguang",
    "url": "https://doi.org/10.1016/j.combustflame.2018.03.013",
    "psiCodes": [
      "PSI-142"
    ]
  },
  {
    "title": "Maximizing ion-driven gas flows",
    "authors": "Rickard Matthew, Dunn-Rankin Derek, Weinberg Felix, Carleton Fred",
    "url": "https://doi.org/10.1016/j.elstat.2005.09.005",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Measurement and analysis of soot inception limits of oxygen-enriched coflow flames",
    "authors": "Kumfer B.M., Skeen S.A., Chen R., Axelbaum R.L.",
    "url": "https://doi.org/10.1016/j.combustflame.2006.08.004",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Measurement of Smoke Particle Size under Low-Gravity Conditions",
    "authors": "Urban David L., Ruff Gary A., Mulholland George W., Cleary Thomas G., Yang Jiann C., Yuan Zengguang",
    "url": "https://doi.org/10.4271/2008-01-2089",
    "psiCodes": [
      "PSI-102"
    ]
  },
  {
    "title": "Measurements and calculations of formaldehyde concentrations in a methane/N2/air, non-premixed flame: Implications for heat release rate",
    "authors": "Dworkin S.B., Schaffer A.M., Connelly B.C., Long M.B., Smooke M.D., Puccio M.A., McAndrew B., Miller J.H.",
    "url": "https://doi.org/10.1016/j.proci.2008.05.083",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Measuring heat flux to a porous burner in microgravity",
    "authors": "Markan Akshit, Sunderland Peter B., Quintiere James G., de Ris John L., Baum Howard R.",
    "url": "https://doi.org/10.1016/j.proci.2018.05.006",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Microgravity burner-generated spherical diffusion flames: experiment and computation. Currently at Department of Mechanical and Aerospace Engineering, Case Western Reserve University, Cleveland, OH 44106.",
    "authors": "Tse Stephen D, Zhu Delin, Sung Chih-Jen, Ju Yiguang, Law Chung K",
    "url": "https://doi.org/10.1016/S0010-2180(01)00247-4",
    "psiCodes": [
      "PSI-22",
      "PSI-23"
    ]
  },
  {
    "title": "Microgravity droplet combustion: effect of tethering fiber on burning rate and flame structure",
    "authors": "Farouk T., Dryer F. L.",
    "url": "https://doi.org/10.1080/13647830.2010.547601",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Microgravity flammability boundary for PMMA rods in axial stagnation flow: Experimental results and energy balance analyses",
    "authors": "Olson Sandra L., Ferkul Paul V.",
    "url": "https://doi.org/10.1016/j.combustflame.2017.03.001",
    "psiCodes": [
      "PSI-25",
      "PSI-62"
    ]
  },
  {
    "title": "Modeled quenching limits of spherical hydrogen diffusion flames",
    "authors": "Lecoustre V.R., Sunderland P.B., Chao B.H., Axelbaum R.L.",
    "url": "https://doi.org/10.1016/j.proci.2012.07.029",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Modeling of Elevated Pressure Diffusion Flames with Water Addition",
    "authors": "Chien Yu-Chien, Girodon Hugo, Esquivias Rodriguez Brandon",
    "url": "https://doi.org/10.1080/00102202.2023.2182205",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Modelling electric field driven convection in small combustion plasmas and surrounding gases",
    "authors": "Papac M. J., Dunn-Rankin D.",
    "url": "https://doi.org/10.1080/13647830701383814",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "n-Butanol droplet combustion: Numerical modeling and reduced gravity experiments",
    "authors": "Alam Fahd E., Liu Y.C., Avedisian C.T., Dryer F.L., Farouk T.I.",
    "url": "https://doi.org/10.1016/j.proci.2014.06.043",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "Non-premixed axisymmetric flames driven by ion currents",
    "authors": "Tinajero Jesse, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.combustflame.2018.10.036",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Nonane droplet combustion with and without buoyant convection: Flame structure, burning rate and extinction in air and helium",
    "authors": "Bae J.H., Avedisian C.T.",
    "url": "https://doi.org/10.1016/j.proci.2008.06.221",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Nonlinear Analysis of Pulsating Instabilities in Diffusion Flames",
    "authors": "Wang Heyang, Bechtold John, Law Chung",
    "url": "https://doi.org/10.2514/6.2005-544",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Numerical and experimental observations of spherical diffusion flames",
    "authors": "Santa K. J., Sun Z., Chao B. H., Sunderland P. B., Axelbaum R. L., Urban D. L., Stocker D. P.",
    "url": "https://doi.org/10.1080/13647830601161567",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Numerical investigation of spherical diffusion flames at their sooting limits",
    "authors": "Lecoustre V.R., Sunderland P.B., Chao B.H., Axelbaum R.L.",
    "url": "https://doi.org/10.1016/j.combustflame.2011.05.022",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Numerical prediction of ion current from a small methane jet flame",
    "authors": "Yamashita Kiyotaka, Karnani Sunny, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.combustflame.2009.02.002",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Numerical simulation of a tubular ion-driven wind generator",
    "authors": "Rickard Matthew, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.elstat.2007.04.003",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Numerical Simulation of Unsteady Flows and Shape Oscillations in Liquid Droplets Induced by Deployment Needle Retraction",
    "authors": "Yan Jin, Shaw Benjamin D.",
    "url": "https://doi.org/10.1007/s12217-008-9096-2",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Numerical studies of flows over liquid droplets on cylindrical fibers",
    "authors": "Shringi D., Dwyer H.A., Shaw B.D.",
    "url": "https://doi.org/10.1016/j.compfluid.2013.02.011",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "Numerical study of flame structure and soot inception interpreted in carbon-to-oxygen atom ratio space",
    "authors": "Xia Fei, Yablonsky Gregory S., Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.proci.2012.06.043",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Observation of water–gas shift equilibrium in diffusion flames",
    "authors": "Wu Wendong, Yablonsky Gregory, Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.combustflame.2016.07.025",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Observations of long duration microgravity spherical diffusion flames aboard the International Space Station",
    "authors": "Irace Phillip H., Lee Han Ju, Waddell Kendyl, Tan Logan, Stocker Dennis P., Sunderland Peter B., Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.combustflame.2021.02.019",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "On burner-stabilized cylindrical premixed flames in microgravity",
    "authors": "Eng J.A., Law C.K., Zhu D.L.",
    "url": "https://doi.org/10.1016/S0082-0784(06)80819-2",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "On burner-supported, spherical diffusion flames under micro-buoyancy conditions",
    "authors": "Sung C., Zhu D., Tse S., Law C.",
    "url": "https://doi.org/10.2514/6.1998-563",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "On colliding spherical flames: Morphology, corner dynamics, and flame-generated vorticity",
    "authors": "Yang Sheng, Zhu Delin, Law Chung K.",
    "url": "https://doi.org/10.1016/j.combustflame.2015.10.029",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "On intrinsic oscillation in radiation-affected diffusion flames",
    "authors": "Wang H.Y., Law C.K.",
    "url": "https://doi.org/10.1016/j.proci.2006.07.183",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "On micro-buoyancy spherical diffusion flames and a double luminous zone structure of the hydrogen/methane flame",
    "authors": "Sung C.J., Zhu D.L., Law C.K.",
    "url": "https://doi.org/10.1016/S0082-0784(98)80108-2",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "On Radical-Induced Ignition in Combustion Systems",
    "authors": "Liang Wenkai, Law Chung K.",
    "url": "https://doi.org/10.1146/annurev-chembioeng-060718-030141",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "On Soot Inception in Nonpremixed Flames and the Effects of Flame Structure",
    "authors": "CHAO B. H., LIU S., AXELBAUM R. L.",
    "url": "https://doi.org/10.1080/00102209808952065",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "On the chemical characteristics and dynamics of n-alkane low-temperature multistage diffusion flames",
    "authors": "Yehia Omar R., Reuter Christopher B., Ju Yiguang",
    "url": "https://doi.org/10.1016/j.proci.2018.06.161",
    "psiCodes": [
      "PSI-142"
    ]
  },
  {
    "title": "On the existence of steady-state gaseous microgravity spherical diffusion flames in the presence of radiation heat loss",
    "authors": "Irace Phillip H., Waddell Kendyl A., Constales Denis, Kim Minhyeng, Yablonsky Gregory, Sunderland Peter B., Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.proci.2022.07.049",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "On the extinction characteristics of alcohol droplet combustion under microgravity conditions – A numerical study",
    "authors": "Farouk Tanvir I., Dryer Frederick L.",
    "url": "https://doi.org/10.1016/j.combustflame.2012.04.005",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "On the propagation limits and speeds of premixed cool flames at elevated pressures",
    "authors": "Ju Yiguang",
    "url": "https://doi.org/10.1016/j.combustflame.2017.01.006",
    "psiCodes": [
      "PSI-142"
    ]
  },
  {
    "title": "On the response of spherical premixed flames under rotation",
    "authors": "Qian J., Bechtold J.K., Law C.K.",
    "url": "https://doi.org/10.1016/S0010-2180(97)00051-5",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "On the spherically symmetrical combustion of methyl decanoate droplets and comparisons with detailed numerical modeling",
    "authors": "Liu Yu Cheng, Farouk Tanvir, Savas Anthony J., Dryer Frederick L., Thomas Avedisian C.",
    "url": "https://doi.org/10.1016/j.combustflame.2012.11.006",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "On the spreading of unsteady cylindrical diffusion flames",
    "authors": "Qian J., Law C.K.",
    "url": "https://doi.org/10.1016/S0010-2180(97)00069-2",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "On the structure, stabilization, and dual response of flat-burner flames",
    "authors": "Eng J.A., Zhu D.L., Law C.K.",
    "url": "https://doi.org/10.1016/0010-2180(94)00102-X",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Operation and Development Status of the Spacecraft Fire Experiments (Saffire), 46th International Conference on Environmental Systems (ICES), July 2016",
    "authors": "Ruff G.A., Urban D.L.",
    "url": "https://ntrs.nasa.gov/citations/20170000230",
    "psiCodes": [
      "PSI-100"
    ]
  },
  {
    "title": "Opportunities and challenges of combustion in microgravity",
    "authors": "Law C.K., Faeth G.M.",
    "url": "https://doi.org/10.1016/0360-1285(94)90006-X",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Opposed-flow flame spread: A comparison of microgravity and normal gravity experiments to establish the thermal regime",
    "authors": "Bhattacharjee Subrata, Laue Matthew, Carmignani Luca, Ferkul Paul, Olson Sandra",
    "url": "https://doi.org/10.1016/j.firesaf.2015.11.011",
    "psiCodes": [
      "PSI-25",
      "PSI-26"
    ]
  },
  {
    "title": "OS24-1 The Effect of Boundary Layer on Blow-Off Extinction in Opposed-Flow Flame Spread: Results of Experiments and Simplified Analysis(invited,Scale modeling on solid combustion,OS24 Scale modeling,FLUID AND THERMODYNAMICS)",
    "authors": "Bhattacharjee Subrata, Cartnignani Luca",
    "url": "https://doi.org/10.1299/jsmeatem.2015.14.289",
    "psiCodes": [
      "PSI-26"
    ]
  },
  {
    "title": "Oscillatory cool flame combustion behavior of submillimeter sized n-alkane droplet under near limit conditions (2019)",
    "authors": "Alam Fahd E., Aghdam Ali Charchi, Dryer Frederick L., Farouk Tanvir I.",
    "url": "https://doi.org/10.1016/j.proci.2018.05.151",
    "psiCodes": [
      "PSI-117"
    ]
  },
  {
    "title": "Oscillatory extinction of spherical diffusion flames: Micro-buoyancy experiment and computation",
    "authors": "Yoo S.W., Christiansen E.W., Law C.K.",
    "url": "https://doi.org/10.1016/S1540-7489(02)80008-6",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Oxygen Lewis Number Effects on Reduced Gravity Combustion of Methanol and Heptane Droplets",
    "authors": "Shaw Benjamin D., Vang Chang L.",
    "url": "https://doi.org/10.1080/00102202.2015.1072176",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Partial-Burning Regime for Quasi-Steady Droplet Combustion Supported by Cool Flames",
    "authors": "Nayagam Vedha, Dietrich Daniel L., Williams Forman A.",
    "url": "https://doi.org/10.2514/1.J054437",
    "psiCodes": [
      "PSI-39",
      "PSI-69"
    ]
  },
  {
    "title": "Particle Morphology and Size Results from the Smoke Aerosol Measurement Experiment-2",
    "authors": "Urban David, Ruff Gary, Greenberg Paul, Fischer David, Meyer Marit, Mulholland George, Yuan Zeng-guang, Bryg Victoria, Cleary Thomas, Yang Jiann",
    "url": "https://doi.org/10.2514/6.2012-3536",
    "psiCodes": [
      "PSI-101"
    ]
  },
  {
    "title": "PLIF and chemiluminescence in a small laminar coflow methane-air diffusion flame at elevated pressures",
    "authors": "Escofet-Martin David, Chien Yu-Chien, Dunn-Rankin Derek",
    "url": "https://doi.org/10.1016/j.combustflame.2022.112067",
    "psiCodes": [
      "PSI-22"
    ]
  },
  {
    "title": "Porous spherical burner for combustion experimentation",
    "authors": "Yoo Sean W., Zhu Delin, Law Chung K.",
    "url": "https://doi.org/10.1063/1.2212399",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "PROPANOL DROPLET FLAMMABILITY AND COMBUSTION IN AIR-DILUENT ENVIRONMENTS UNDER NORMAL AND REDUCED GRAVITY",
    "authors": "SHAW B. D., WEI J. B.",
    "url": "https://doi.org/10.1080/00102200601057394",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Pyrolysis Smoke Generated Under Low-Gravity Conditions",
    "authors": "Mulholland George W., Meyer Marit, Urban David L., Ruff Gary A., Yuan Zeng-guang, Bryg Victoria, Cleary Thomas, Yang Jiann",
    "url": "https://doi.org/10.1080/02786826.2015.1025125",
    "psiCodes": [
      "PSI-102"
    ]
  },
  {
    "title": "Quantitative measurements of HO 2 /H 2 O 2 and intermediate species in low and intermediate temperature oxidation of dimethyl ether",
    "authors": "Kurimoto Naoki, Brumfield Brian, Yang Xueliang, Wada Tomoya, Diévart Pascal, Wysocki Gerard, Ju Yiguang",
    "url": "https://doi.org/10.1016/j.proci.2014.05.120",
    "psiCodes": [
      "PSI-142"
    ]
  },
  {
    "title": "Quasi-steady combustion of normal-alkane droplets supported by Cool-Flame chemistry near diffusive extinction",
    "authors": "Williams Forman A., Nayagam Vedha",
    "url": "https://doi.org/10.1080/13647830.2019.1588380",
    "psiCodes": [
      "PSI-68"
    ]
  },
  {
    "title": "Radiation signature in opposed-flow flame spread",
    "authors": "Bhattacharjee Subrata, Paolini Christopher P., Miller Fletcher, Nagarkar Rohit",
    "url": "https://doi.org/10.1504/PCFD.2012.048249",
    "psiCodes": [
      "PSI-26"
    ]
  },
  {
    "title": "Radiative extinction of burner-supported spherical diffusion flames: A scaling analysis",
    "authors": "Nayagam Vedha, Dietrich Daniel L., Williams Forman A.",
    "url": "https://doi.org/10.1016/j.combustflame.2019.04.027",
    "psiCodes": [
      "PSI-68"
    ]
  },
  {
    "title": "Radiative extinction of gaseous spherical diffusion flames in microgravity",
    "authors": "SANTA K, CHAO B, SUNDERLAND P, URBAN D, STOCKER D, AXELBAUM R",
    "url": "https://doi.org/10.1016/j.combustflame.2007.08.009",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Radiative Extinction of Laminar Diffusion Flame above the Flat Porous Burner in Microgravity: A Computational Study",
    "authors": "Kuznetsov E. A., Snegirev A. Yu., Markus E. S.",
    "url": "https://doi.org/10.1134/S0010508220040036",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Radiative extinction of large n-alkane droplets in oxygen-inert mixtures in microgravity",
    "authors": "Nayagam Vedha, Dietrich Daniel L., Hicks Michael C., Williams Forman A.",
    "url": "https://doi.org/10.1016/j.combustflame.2018.04.023",
    "psiCodes": [
      "PSI-68"
    ]
  },
  {
    "title": "Radiative flamelet generated manifolds for solid fuel flame spread in microgravity (2023)",
    "authors": "Budzinski Kenneth, DesJardin Paul E.",
    "url": "https://doi.org/10.1016/j.combustflame.2023.112939",
    "psiCodes": [
      "PSI-62"
    ]
  },
  {
    "title": "Radiative, thermal, and kinetic regimes of opposed-flow flame spread: A comparison between experiment and theory",
    "authors": "Bhattacharjee Subrata, Simsek Aslihan, Miller Fletcher, Olson Sandra, Ferkul Paul",
    "url": "https://doi.org/10.1016/j.proci.2016.06.025",
    "psiCodes": [
      "PSI-25"
    ]
  },
  {
    "title": "Reduced Gravity Combustion of Propanol Droplets in Oxygen-Inert Environments",
    "authors": "Wei J. B., Shaw B. D.",
    "url": "https://doi.org/10.1080/00102200903190851",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Response of spherical diffusion flames subjected to rotation: Microgravity experimentation and computational simulation",
    "authors": "Yoo Sean W., Chaudhuri Swetaprovo, Sacksteder Kurt R., Zhang Peng, Zhu Delin, Law Chung K.",
    "url": "https://doi.org/10.1016/j.combustflame.2011.07.013",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Response of spherical diffusion flames under rotation with general Lewis numbers",
    "authors": "Yoo S. W., Qian J., Bechtold J. K., Law C. K.",
    "url": "https://doi.org/10.1080/13647830500098423",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Role of flamefront motion and criterion for global quasi-steadiness in droplet burning",
    "authors": "He Longtin, Tse Stephen D., Law Chung K.",
    "url": "https://doi.org/10.1016/S0082-0784(98)80038-6",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Scalar dissipation rate at extinction and the effects of oxygen-enriched combustion",
    "authors": "Chen R., Axelbaum R.L.",
    "url": "https://doi.org/10.1016/j.combustflame.2005.02.008",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Scaling of Gas-Jet Flame Lengths in Elevated Gravity",
    "authors": "Sunderland Peter B., Urban David L., Nayagam Vedha",
    "url": "https://doi.org/10.1007/978-1-4020-8682-3_22",
    "psiCodes": [
      "PSI-107"
    ]
  },
  {
    "title": "Self-similar accelerative propagation of expanding wrinkled flames and explosion triggering",
    "authors": "Akkerman V’yacheslav, Law Chung K., Bychkov Vitaly",
    "url": "https://doi.org/10.1103/PhysRevE.83.026305",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Shapes of nonbuoyant round hydrocarbon-fueled laminar-jet diffusion flames in still air",
    "authors": "Aalburg C., Diez F.J., Faeth G.M., Sunderland P.B., Urban D.L., Yuan Z.-G.",
    "url": "https://doi.org/10.1016/j.combustflame.2004.12.009",
    "psiCodes": [
      "PSI-107"
    ]
  },
  {
    "title": "Shapes of nonbuoyant round luminous hydrocarbon/air laminar jet diffusion flames",
    "authors": "LIN K, FAETH G, SUNDERLAND P, URBAN D, YUAN Z",
    "url": "https://doi.org/10.1016/S0010-2180(98)00100-X",
    "psiCodes": [
      "PSI-107"
    ]
  },
  {
    "title": "Signal-to-noise ratio improvements in laser flow diagnostics using time-resolved image averaging and high dynamic range imaging",
    "authors": "Giassi Davide, Long Marshall B.",
    "url": "https://doi.org/10.1007/s00348-016-2218-5",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Simplified model for predicting difference between flammability limits of a thin material in normal gravity and microgravity environments",
    "authors": "Takahashi Shuhei, Ebisawa Tomoya, Bhattacharjee Subrata, Ihara Tadayoshi",
    "url": "https://doi.org/10.1016/j.proci.2014.07.017",
    "psiCodes": [
      "PSI-26"
    ]
  },
  {
    "title": "Simplifying the complexity of diffusion flames through interpretation in C/O ratio space",
    "authors": "Xia Fei, Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.camwa.2013.01.008",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Smoke Aerosol Measurement Experiment-2: Comparison of Flight Experiment Results with Ground Test Results",
    "authors": "Meyer Marit E., Urban David L., Ruff Gary A., Mulholland George, Yuan Zeng-guang, Bryg Victoria, Cleary Thomas, Yang Jiann",
    "url": "https://doi.org/10.2514/6.2013-3433",
    "psiCodes": [
      "PSI-101"
    ]
  },
  {
    "title": "Smoke Characterization and Feasibility of the Moment Method for Spacecraft Fire Detection",
    "authors": "Meyer Marit E., Mulholland George W., Bryg Victoria, Urban David L., Yuan Zeng-Guang, Ruff Gary A., Cleary Thomas, Yang Jiann",
    "url": "https://doi.org/10.1080/02786826.2015.1025124",
    "psiCodes": [
      "PSI-102"
    ]
  },
  {
    "title": "Smoke Particle Sizes in Low-Gravity and Implications for Spacecraft Smoke Detector Design",
    "authors": "Urban David L., Ruff Gary A., Mulholland George W., Cleary Thomas G., Yang Jiann C., Yuan Zengguang, Bryg Victoria",
    "url": "https://doi.org/10.4271/2009-01-2468",
    "psiCodes": [
      "PSI-102"
    ]
  },
  {
    "title": "Soot and thin-filament pyrometry using a color digital camera",
    "authors": "Kuhn Peter B., Ma Bin, Connelly Blair C., Smooke Mitchell D., Long Marshall B.",
    "url": "https://doi.org/10.1016/j.proci.2010.05.006",
    "psiCodes": [
      "PSI-21"
    ]
  },
  {
    "title": "Soot Formation in Spherical Diffusion Flames",
    "authors": "Frolov Sergey M., Ivanov Vladislav S., Frolov Fedor S., Vlasov Pavel A., Axelbaum Richard, Irace Phillip H., Yablonsky Grigoriy, Waddell Kendyl",
    "url": "https://doi.org/10.3390/math11020261",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Soot inception limits in laminar diffusion flames with application to oxy–fuel combustion",
    "authors": "Kumfer B.M., Skeen S.A., Axelbaum R.L.",
    "url": "https://doi.org/10.1016/j.combustflame.2008.03.008",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "SOOTING LIMITS OF MICROGRAVITY SPHERICAL DIFFUSION FLAMES IN OXYGEN-ENRICHED AIR AND DILUTED FUEL",
    "authors": "SUNDERLAND P. B., URBAN D. L., STOCKER D. P., CHAO B.-H., AXELBAUM∗ R. L.",
    "url": "https://doi.org/10.1080/00102200490514994",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Spacecraft Fire Detection: Smoke Properties and Transport in Low-Gravity",
    "authors": "Urban David, Ruff Gary, Brooker John, Cleary Thomas, Yang Jiann, Mulholland George, Yuan Zeng-Guang",
    "url": "https://doi.org/10.2514/6.2008-806",
    "psiCodes": [
      "PSI-102"
    ]
  },
  {
    "title": "SPHERICAL DIFFUSION FLAME IN MICROGRAVITY CONDITIONS: FIRST RESULTS OF JOINT RUSSIAN-AMERICAN SPACE EXPERIMENT FLAME DESIGN - ADAMANT",
    "authors": "undefined undefined, FROLOV S. M.",
    "url": "https://doi.org/10.30826/NEPCAP9B-13",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Spherical gas-fueled cool diffusion flames",
    "authors": "Kim Minhyeng, Waddell Kendyl A., Sunderland Peter B., Nayagam Vedha, Stocker Dennis P., Dietrich Daniel L., Ju Yiguang, Williams Forman A., Irace Phillip, Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.proci.2022.07.015",
    "psiCodes": [
      "PSI-159"
    ]
  },
  {
    "title": "Spherically symmetric droplet combustion of three and four component miscible mixtures as surrogates for Jet-A",
    "authors": "Liu Yu Cheng, Savas Anthony J., Thomas Avedisian C.",
    "url": "https://doi.org/10.1016/j.proci.2012.05.065",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "Stability of spray combustion for water/alcohols mixtures in oxygen-enriched air",
    "authors": "Yi Fei, Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.proci.2012.05.088",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Stabilization mechanisms and burning rates of cylindrical burner flames",
    "authors": "Eng J., Law C., Zhu D.",
    "url": "https://doi.org/10.2514/6.1994-571",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Structure and extinction of spherical burner-stabilized diffusion flames that are attached to the burner surface",
    "authors": "Rodenhurst Melvin K., Chao Beei-Huan, Sunderland Peter B., Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.combustflame.2017.08.024",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "Structure, aerodynamics, and geometry of premixed flamelets",
    "authors": "Law C.K, Sung C.J",
    "url": "https://doi.org/10.1016/S0360-1285(00)00018-6",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Study of ignition and extinction of small-scale fires in experiments with an emulating gas burner",
    "authors": "Lundström Frida Vermina, Sunderland Peter B., Quintiere James G., van Hees Patrick, de Ris John L.",
    "url": "https://doi.org/10.1016/j.firesaf.2016.11.003",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Study of the low-temperature reactivity of large n-alkanes through cool diffusion flame extinction",
    "authors": "Reuter Christopher B., Lee Minhyeok, Won Sang Hee, Ju Yiguang",
    "url": "https://doi.org/10.1016/j.combustflame.2017.01.028",
    "psiCodes": [
      "PSI-142"
    ]
  },
  {
    "title": "Sub-millimeter sized methyl butanoate droplet combustion: Microgravity experiments and detailed numerical modeling",
    "authors": "Farouk T.I., Liu Y.C., Savas A.J., Avedisian C.T., Dryer F.L.",
    "url": "https://doi.org/10.1016/j.proci.2012.07.074",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Sub-millimeter sized multi-component jet fuel surrogate droplet combustion: Physicochemical preferential vaporization effects (2021)",
    "authors": "Farouk Tanvir I., Won Sang Hee, Dryer Frederick L.",
    "url": "https://doi.org/10.1016/j.proci.2020.06.200",
    "psiCodes": [
      "PSI-117"
    ]
  },
  {
    "title": "Temperature and CO2 fields of a downward spreading flame over thin cellulose: A comparison of experimental and computational results",
    "authors": "Bhattacharjee Subrata, Paolini Christopher, Tran Wynn, Villaraza Jeanie Ray, Takahashi Shuhei",
    "url": "https://doi.org/10.1016/j.proci.2014.05.093",
    "psiCodes": [
      "PSI-25"
    ]
  },
  {
    "title": "Temperature and fiber optic spectroscopy composition measurements of heated propanol–acetone droplets",
    "authors": "Xiao J.S., Wei J.B., Shaw B.D., Peng Z.",
    "url": "https://doi.org/10.1016/j.optlaseng.2009.05.004",
    "psiCodes": [
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "Tethered methanol droplet combustion in carbon-dioxide enriched environment under microgravity conditions",
    "authors": "Farouk Tanvir, Dryer Frederick L.",
    "url": "https://doi.org/10.1016/j.combustflame.2011.06.014",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "The critical flow velocity for radiative extinction in opposed-flow flame spread in a microgravity environment: A comparison of experimental, computational, and theoretical results",
    "authors": "Bhattacharjee Subrata, Simsek Aslihan, Olson Sandra, Ferkul Paul",
    "url": "https://doi.org/10.1016/j.combustflame.2015.10.023",
    "psiCodes": [
      "PSI-25"
    ]
  },
  {
    "title": "The effect of support fibers on micro-convection in droplet combustion experiments",
    "authors": "Liu Y.C., Xu Y., Avedisian C.T., Hicks M.C.",
    "url": "https://doi.org/10.1016/j.proci.2014.07.022",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "The effects of elevated pressure on the kinetics and extinction of hot, warm, and cool gaseous ethylene spherical diffusion flames",
    "authors": "Waddell Kendyl A., Yablonsky Gregory, Constales Denis, Sunderland Peter B., Axelbaum Richard L.",
    "url": "https://doi.org/10.1016/j.proci.2024.105400",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "The kinetics and warm flame chemistry associated with radiative extinction of spherical diffusion flames",
    "authors": "Waddell Kendyl A., Irace Phillip H., Yablonsky Gregory, Constales Denis, Sunderland Peter B., Axelbaum Richard L.",
    "url": "https://doi.org/10.1080/13647830.2024.2326830",
    "psiCodes": [
      "PSI-10"
    ]
  },
  {
    "title": "The Microgravity Science Glovebox (MSG), a Resource for Gravity-Dependent Phenomena Research on the International Space Station (ISS)",
    "authors": "Spivey Reggie, Jeter Linda, Vonk Chris",
    "url": "https://doi.org/10.2514/6.2007-546",
    "psiCodes": [
      "PSI-102"
    ]
  },
  {
    "title": "The Microgravity Science Glovebox as a Platform for Exploration Research on the International Space Station",
    "authors": "Spivey Reggie, Luz Paul",
    "url": "https://doi.org/10.2514/6.2006-941",
    "psiCodes": [
      "PSI-26",
      "PSI-107"
    ]
  },
  {
    "title": "The radical index and the effect of oxygen concentration on non-premixed cool flame extinction of large n-alkanes",
    "authors": "Zhou Mengni, Yehia Omar R., Xu Wenbin, Reuter Christopher B., Wang Ziyu, Yan Chao, Jiang Bo, Ju Yiguang",
    "url": "https://doi.org/10.1016/j.combustflame.2021.111471",
    "psiCodes": [
      "PSI-142"
    ]
  },
  {
    "title": "The role of cool-flame chemistry in quasi-steady combustion and extinction of n-heptane droplets",
    "authors": "Paczko Guenter, Peters Norbert, Seshadri Kalyanasundaram, Williams Forman Arthur",
    "url": "https://doi.org/10.1080/13647830.2014.934296",
    "psiCodes": [
      "PSI-39",
      "PSI-68",
      "PSI-69"
    ]
  },
  {
    "title": "The spherically symmetric droplet burning characteristics of Jet-A and biofuels derived from camelina and tallow",
    "authors": "Liu Yu Cheng, Savas Anthony J., Avedisian C. Thomas",
    "url": "https://doi.org/10.1016/j.fuel.2013.02.025",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "Theoretical analysis and predictions of burning in microgravity using a burning emulator",
    "authors": "Dehghani Parham, Quintiere James G.",
    "url": "https://doi.org/10.1016/j.combustflame.2021.111572",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Theoretical estimates of flammability bounds for thin condensed fuel diffusion flames in microgravity using detailed models of chemistry and radiation (2023)",
    "authors": "Budzinski Kenneth, DesJardin Paul E.",
    "url": "https://doi.org/10.1016/j.combustflame.2023.112910",
    "psiCodes": [
      "PSI-62"
    ]
  },
  {
    "title": "Theory of first-stage ignition delay in hydrocarbon NTC chemistry",
    "authors": "Liang Wenkai, Law Chung K.",
    "url": "https://doi.org/10.1016/j.combustflame.2017.10.003",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Theory of the propagation dynamics of spiral edges of diffusion flames in von Kármán swirling flows",
    "authors": "Urzay Javier, Nayagam Vedha, Williams Forman A.",
    "url": "https://doi.org/10.1016/j.combustflame.2010.08.015",
    "psiCodes": [
      "PSI-69"
    ]
  },
  {
    "title": "Thin-Flame Theory for Droplet Combustion at Low Grashof Numbers",
    "authors": "Chen Shr-Jing, Tse Stephen",
    "url": "https://doi.org/10.2514/6.2005-1140",
    "psiCodes": [
      "PSI-23"
    ]
  },
  {
    "title": "Transient dynamics of radiative extinction in low-momentum microgravity diffusion flames",
    "authors": "Snegirev Alexander, Kuznetsov Egor, Markus Ekaterina, Dehghani Parham, Sunderland Peter",
    "url": "https://doi.org/10.1016/j.proci.2020.06.110",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Transient ellipsoidal combustion model for a porous burner in microgravity",
    "authors": "Markan Akshit, Baum Howard R., Sunderland Peter B., Quintiere James G., de Ris John L.",
    "url": "https://doi.org/10.1016/j.combustflame.2019.09.030",
    "psiCodes": [
      "PSI-20"
    ]
  },
  {
    "title": "Transient flame growth and spread processes over a large solid fabric in concurrent low-speed flows in microgravity – Model versus experiment",
    "authors": "Li Chengyao, Liao Ya-Ting T., T'ien James S., Urban David L., Ferkul Paul, Olson Sandra, Ruff Gary A., Easton John",
    "url": "https://doi.org/10.1016/j.proci.2018.05.168",
    "psiCodes": [
      "PSI-98",
      "PSI-99"
    ]
  },
  {
    "title": "Transient interactions between a premixed double flame and a vortex",
    "authors": "Reuter Christopher B., Katta Viswanath R., Yehia Omar R., Ju Yiguang",
    "url": "https://doi.org/10.1016/j.proci.2018.07.050",
    "psiCodes": [
      "PSI-142"
    ]
  },
  {
    "title": "Two-color pyrometry based flame to fuel surface radiative heat flux diagnostic using flamelets",
    "authors": "Aphale Siddhant S., DesJardin Paul E.",
    "url": "https://doi.org/10.1016/j.combustflame.2021.111395",
    "psiCodes": [
      "PSI-62"
    ]
  },
  {
    "title": "Unsteady droplet combustion with fuel thermal expansion",
    "authors": "Nayagam Vedha, Dietrich Daniel L., Williams Forman A.",
    "url": "https://doi.org/10.1016/j.combustflame.2018.01.035",
    "psiCodes": [
      "PSI-68"
    ]
  },
  {
    "title": "Using large electric fields to control transport in microgravity.",
    "authors": "Dunn-Rankin D, Weinberg FJ.",
    "url": "https://doi.org/10.1196/annals.1362.037",
    "psiCodes": [
      "PSI-22"
    ]
  }
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "what", "does",
  "how", "why", "which", "when", "where", "are", "was", "were", "can", "could",
  "make", "more", "than", "about", "have", "has", "been", "they", "their", "them",
  "under", "over", "between", "in", "on", "of", "to", "a", "an", "or", "is", "it",
  "do", "did", "not", "by", "as", "at", "its",
]);

const DOC_PSI_MAP: Record<string, readonly string[]> = {
  ACME_CFI_G_FINAL_REPORT: ["PSI-159"],
  "ACME_CFI-G_FINAL_REPORT": ["PSI-159"],
  "BASS-II_SRD": ["PSI-25"],
  BASS_SRD: ["PSI-26"],
  BASS_DLD: ["PSI-26"],
  DAFT_30_DAY_POSTFLIGHT_REPORT: ["PSI-47"],
  "DAFT_30-DAY_POSTFLIGHT_REPORT": ["PSI-47"],
  "ISS-BASS-II": ["PSI-25"],
  "ISS-ACME": ["PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-23", "PSI-159"],
  "ISS-FLEX": ["PSI-68", "PSI-69", "PSI-39"],
  "ISS-SAFFIRE": ["PSI-98", "PSI-99", "PSI-100"],
  "ISS-SOFIE": ["PSI-60", "PSI-62", "PSI-106", "PSI-107"],
  SAFFIRE_OBJECTIVES_DEVELOPMENT_STATUS: ["PSI-98", "PSI-99", "PSI-100"],
  SAME_FINAL_SCIENCE_REPORT: ["PSI-101", "PSI-102"],
  "SAME-R_FINAL_REPORT": ["PSI-101", "PSI-102"],
  SPICE_FINAL_REPORT: ["PSI-107"],
  SPICE_DOTSON_THESIS_SMOKE_POINTS: ["PSI-107"],
  NASA_RESEARCHERS_GUIDE_ORIGINAL: ["PSI-25", "PSI-23", "PSI-69", "PSI-98"],
};

const TOPIC_TO_PSI: readonly [RegExp, readonly string[]][] = [
  [/\bbass[- ]?ii\b|low[- ]speed|forced flow|ventilation|opposed[- ]flow/i, ["PSI-25", "PSI-26"]],
  [/\bbass\b/i, ["PSI-26", "PSI-25"]],
  [/\bsofie\b|artemis|34%|56\.5/i, ["PSI-62", "PSI-98", "PSI-99", "PSI-25"]],
  [/\bsaffire\b/i, ["PSI-98", "PSI-99", "PSI-100", "PSI-101", "PSI-102"]],
  [/\bcool flame\b|heptane|droplet|\bflex\b|\bcfi\b/i, ["PSI-68", "PSI-69", "PSI-39", "PSI-117", "PSI-142"]],
  [/\bspherical\b|flame design/i, ["PSI-10", "PSI-23"]],
  [/\be[- ]?field\b|electric field|ionic/i, ["PSI-22"]],
  [/\bs-?flame\b|soret/i, ["PSI-23"]],
  [/\bbre\b|burning rate emulator/i, ["PSI-20"]],
  [/\bcld\b|coflow/i, ["PSI-21", "PSI-106"]],
  [/\bsmoke\b|\bsame\b|\bdaft\b|particulate|aerosol/i, ["PSI-47", "PSI-101", "PSI-102"]],
  [/\bspice\b|smoke point/i, ["PSI-107"]],
];

export function getDocumentDownloadUrl(docId: string): string {
  return `${env.apiUrl}/api/documents/${encodeURIComponent(docId.trim())}/download`;
}

export function isCsvOrTableDoc(docId: string): boolean {
  const low = docId.trim().toLowerCase();
  return low.endsWith(".csv") || low.endsWith("-table") || low.endsWith("-tables");
}

export function formatDocDisplayName(
  docId: string,
  meta?: DocumentSummary,
): string {
  const raw = meta?.title?.trim();
  if (raw && raw.toLowerCase() !== docId.trim().toLowerCase()) {
    return raw;
  }
  return docId
    .replace(/^(?:NASA|WEB)[_-]+/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTerms(text: string): string[] {
  return [
    ...new Set(
      (text.toLowerCase().match(/[a-z0-9-]+/g) ?? []).filter(
        (w) => w.length > 2 && !STOPWORDS.has(w),
      ),
    ),
  ];
}

function collectPsiCodes(
  docIds: readonly string[],
  documentsById: ReadonlyMap<string, DocumentSummary> | undefined,
  text: string,
): Set<string> {
  const codes = new Set<string>();
  const addMatch = (s: string) => {
    for (const m of s.matchAll(/\bPSI-(\d+)\b/gi)) {
      codes.add(`PSI-${m[1]}`);
    }
  };
  addMatch(text);
  for (const docId of docIds) {
    addMatch(docId);
    const upper = docId.toUpperCase();
    for (const code of DOC_PSI_MAP[upper] ?? []) codes.add(code);
    const meta = documentsById?.get(docId) ?? documentsById?.get(upper);
    if (meta?.investigation) addMatch(meta.investigation);
    if (meta?.url) addMatch(meta.url);
  }
  for (const [pat, matchedCodes] of TOPIC_TO_PSI) {
    if (pat.test(text)) {
      for (const code of matchedCodes) codes.add(code);
    }
  }
  return codes;
}

export function findRelevantPsiPublications({
  docIds = [],
  documentsById,
  question = "",
  answer = "",
  limit = 6,
}: {
  docIds?: readonly string[];
  documentsById?: ReadonlyMap<string, DocumentSummary>;
  question?: string;
  answer?: string;
  limit?: number;
}): PsiPublication[] {
  const combinedText = `${question} ${docIds.join(" ")} ${answer}`;
  const psiCodes = collectPsiCodes(docIds, documentsById, combinedText);
  const qTerms = extractTerms(question);
  const ctxTerms = extractTerms(`${docIds.join(" ")} ${answer}`);

  const scored: { pub: PsiPublication; score: number }[] = [];
  for (const pub of PSI_PUBLICATIONS) {
    let score = 0;
    const titleLow = pub.title.toLowerCase();
    const authorsLow = pub.authors.toLowerCase();

    for (const code of pub.psiCodes) {
      if (psiCodes.has(code)) score += 20;
    }
    for (const term of qTerms) {
      if (titleLow.includes(term)) score += 14;
      else if (authorsLow.includes(term)) score += 6;
    }
    for (const term of ctxTerms) {
      if (titleLow.includes(term)) score += 3;
    }
    if (score > 0) {
      scored.push({ pub, score });
    }
  }

  scored.sort(
    (a, b) => b.score - a.score || a.pub.title.localeCompare(b.pub.title),
  );
  return scored.slice(0, limit).map((s) => s.pub);
}
