'use strict';

const PremiereData = (() => {
  const SOURCE = 'swccgpc/swccg-card-json';
  const REVISION = '65cd150d20634447a5499d763ac324436158c7a8';
  const EDITION = '1';
  const A_NEW_HOPE = '2';
  const HOTH = '3';
  const DAGOBAH='4';
  const CLOUD_CITY='5',CLOUD_CITY_RULES_VERSION=33;
  const JABBAS_PALACE='6',JABBAS_PALACE_RULES_VERSION=34,JABBAS_PALACE_RELEASED=new Map([["Light:13","6_1"],["Light:25","6_52"],["Light:126","6_49"],["Light:128","6_2"],["Light:136","6_3"],["Light:140","6_60"],["Light:170","6_4"],["Light:174","6_5"],["Light:197","6_6"],["Light:198","6_53"],["Light:230","6_7"],["Light:260","6_61"],["Light:285","6_54"],["Light:183","6_8"],["Light:387","6_9"],["Light:411","6_62"],["Light:532","6_63"],["Light:722","6_10"],["Light:756","6_64"],["Light:784","6_11"],["Light:797","6_65"],["Light:828","6_12"],["Light:924","6_66"],["Light:962","6_13"],["Light:1012","6_14"],["Light:1014","6_15"],["Light:1037","6_16"],["Light:1059","6_17"],["Light:1138","6_50"],["Light:1092","6_18"],["Light:1151","6_51"],["Light:1218","6_55"],["Light:1329","6_19"],["Light:1339","6_20"],["Light:1351","6_67"],["Light:1354","6_81"],["Light:1358","6_82"],["Light:1388","6_68"],["Light:1393","6_21"],["Light:1408","6_22"],["Light:1417","6_69"],["Light:1435","6_83"],["Light:1442","6_84"],["Light:1447","6_23"],["Light:1449","6_24"],["Light:1482","6_25"],["Light:1505","6_26"],["Light:1546","6_70"],["Light:1575","6_27"],["Light:1638","6_71"],["Light:1660","6_28"],["Light:1699","6_89"],["Light:1753","6_72"],["Light:1842","6_29"],["Light:1861","6_30"],["Light:1890","6_31"],["Light:1945","6_32"],["Light:1956","6_56"],["Light:1964","6_33"],["Light:2026","6_34"],["Light:2087","6_35"],["Light:2109","6_73"],["Light:1988","6_36"],["Light:2156","6_37"],["Light:2171","6_57"],["Light:2227","6_38"],["Light:2247","6_39"],["Light:2263","6_40"],["Light:2274","6_88"],["Light:2276","6_74"],["Light:2292","6_41"],["Light:2300","6_75"],["Light:2361","6_76"],["Light:2415","6_42"],["Light:2420","6_43"],["Light:2443","6_85"],["Light:2450","6_86"],["Light:2507","6_44"],["Light:2543","6_77"],["Light:2593","6_87"],["Light:2665","6_58"],["Light:2679","6_78"],["Light:2714","6_90"],["Light:2730","6_45"],["Light:2771","6_79"],["Light:2829","6_48"],["Light:2844","6_46"],["Light:2845","6_59"],["Light:2890","6_80"],["Light:2903","6_47"],["Dark:49","6_91"],["Dark:50","6_151"],["Dark:90","6_141"],["Dark:102","6_92"],["Dark:103","6_93"],["Dark:119","6_174"],["Dark:122","6_94"],["Dark:188","6_95"],["Dark:193","6_152"],["Dark:196","6_96"],["Dark:214","6_97"],["Dark:232","6_98"],["Dark:339","6_138"],["Dark:350","6_142"],["Dark:393","6_99"],["Dark:594","6_100"],["Dark:697","6_143"],["Dark:705","6_175"],["Dark:764","6_176"],["Dark:796","6_153"],["Dark:878","6_101"],["Dark:887","6_102"],["Dark:978","6_103"],["Dark:1003","6_104"],["Dark:1008","6_177"],["Dark:1009","6_105"],["Dark:1041","6_106"],["Dark:1128","6_107"],["Dark:1130","6_108"],["Dark:1139","6_154"],["Dark:1192","6_144"],["Dark:1195","6_155"],["Dark:1310","6_145"],["Dark:1346","6_109"],["Dark:1350","6_156"],["Dark:1353","6_162"],["Dark:1355","6_163"],["Dark:1356","6_164"],["Dark:1357","6_165"],["Dark:1360","6_166"],["Dark:1362","6_172"],["Dark:1364","6_167"],["Dark:1394","6_140"],["Dark:1342","6_110"],["Dark:1444","6_111"],["Dark:1448","6_112"],["Dark:1633","6_113"],["Dark:1698","6_178"],["Dark:1713","6_114"],["Dark:1750","6_168"],["Dark:1780","6_115"],["Dark:1781","6_116"],["Dark:1795","6_157"],["Dark:1802","6_117"],["Dark:1862","6_118"],["Dark:1928","6_119"],["Dark:1972","6_120"],["Dark:1978","6_146"],["Dark:2021","6_139"],["Dark:2077","6_121"],["Dark:2096","6_147"],["Dark:2159","6_122"],["Dark:2170","6_148"],["Dark:2188","6_149"],["Dark:2273","6_173"],["Dark:2275","6_123"],["Dark:2442","6_169"],["Dark:2449","6_170"],["Dark:2452","6_171"],["Dark:2488","6_124"],["Dark:2556","6_179"],["Dark:2589","6_125"],["Dark:2617","6_158"],["Dark:2628","6_126"],["Dark:2630","6_159"],["Dark:2651","6_160"],["Dark:2706","6_127"],["Dark:2711","6_128"],["Dark:2713","6_180"],["Dark:2724","6_129"],["Dark:2788","6_130"],["Dark:2789","6_131"],["Dark:2790","6_132"],["Dark:2791","6_133"],["Dark:2792","6_150"],["Dark:2804","6_134"],["Dark:2817","6_135"],["Dark:2827","6_136"],["Dark:2831","6_161"],["Dark:2906","6_137"]]);
  const CLOUD_CITY_RELEASED=new Map([["Light:54","5_15"],["Light:66","5_16"],["Light:84","5_17"],["Light:104","5_31"],["Light:133","5_32"],["Light:139","5_33"],["Light:142","5_34"],["Light:217","5_18"],["Light:226","5_76"],["Light:229","5_77"],["Light:244","5_12"],["Light:261","5_35"],["Light:332","5_86"],["Light:360","5_1"],["Light:376","5_36"],["Light:377","5_37"],["Light:392","5_19"],["Light:414","5_20"],["Light:418","5_38"],["Light:426","5_88"],["Light:428","5_89"],["Light:433","5_39"],["Light:434","5_2"],["Light:436","5_3"],["Light:438","5_78"],["Light:442","5_79"],["Light:448","5_80"],["Light:450","5_81"],["Light:453","5_82"],["Light:455","5_83"],["Light:459","5_84"],["Light:464","5_85"],["Light:511","5_40"],["Light:578","5_41"],["Light:583","5_21"],["Light:592","5_13"],["Light:612","5_42"],["Light:640","5_43"],["Light:717","5_44"],["Light:737","5_22"],["Light:749","5_45"],["Light:922","5_46"],["Light:923","5_47"],["Light:989","5_23"],["Light:1006","5_48"],["Light:1042","5_49"],["Light:1112","5_24"],["Light:1132","5_25"],["Light:1143","5_50"],["Light:1145","5_26"],["Light:1157","5_27"],["Light:1206","5_51"],["Light:1293","5_52"],["Light:1313","5_53"],["Light:1323","5_54"],["Light:1334","5_55"],["Light:1419","5_4"],["Light:1422","5_56"],["Light:1466","5_5"],["Light:1476","5_14"],["Light:1493","5_28"],["Light:1549","5_57"],["Light:1562","5_6"],["Light:1603","5_90"],["Light:1797","5_58"],["Light:1821","5_59"],["Light:1828","5_60"],["Light:1875","5_61"],["Light:1897","5_62"],["Light:1943","5_7"],["Light:1960","5_63"],["Light:1966","5_64"],["Light:1970","5_65"],["Light:2073","5_87"],["Light:2084","5_66"],["Light:2092","5_67"],["Light:2252","5_68"],["Light:2285","5_69"],["Light:2301","5_70"],["Light:2387","5_71"],["Light:2393","5_72"],["Light:2571","5_73"],["Light:2592","5_8"],["Light:2631","5_9"],["Light:2640","5_10"],["Light:2670","5_29"],["Light:2779","5_30"],["Light:2758","5_74"],["Light:2810","5_11"],["Light:2825","5_75"],["Dark:46","5_110"],["Dark:48","5_111"],["Dark:73","5_130"],["Dark:87","5_112"],["Dark:162","5_131"],["Dark:225","5_164"],["Dark:228","5_165"],["Dark:243","5_106"],["Dark:257","5_132"],["Dark:287","5_91"],["Dark:293","5_179"],["Dark:316","5_113"],["Dark:330","5_133"],["Dark:355","5_92"],["Dark:379","5_114"],["Dark:380","5_107"],["Dark:409","5_93"],["Dark:425","5_178"],["Dark:427","5_180"],["Dark:430","5_94"],["Dark:432","5_134"],["Dark:435","5_95"],["Dark:437","5_166"],["Dark:441","5_167"],["Dark:444","5_168"],["Dark:447","5_169"],["Dark:449","5_170"],["Dark:452","5_171"],["Dark:457","5_172"],["Dark:458","5_173"],["Dark:463","5_174"],["Dark:492","5_96"],["Dark:614","5_115"],["Dark:625","5_135"],["Dark:714","5_116"],["Dark:763","5_136"],["Dark:765","5_137"],["Dark:800","5_138"],["Dark:801","5_97"],["Dark:841","5_139"],["Dark:879","5_129"],["Dark:960","5_140"],["Dark:964","5_141"],["Dark:968","5_142"],["Dark:972","5_117"],["Dark:1121","5_143"],["Dark:1116","5_144"],["Dark:1188","5_145"],["Dark:1201","5_118"],["Dark:1210","5_119"],["Dark:1268","5_120"],["Dark:1287","5_98"],["Dark:1320","5_108"],["Dark:1465","5_99"],["Dark:1514","5_146"],["Dark:1522","5_100"],["Dark:1537","5_101"],["Dark:1637","5_109"],["Dark:1701","5_121"],["Dark:1817","5_175"],["Dark:1818","5_176"],["Dark:1919","5_147"],["Dark:1937","5_148"],["Dark:1957","5_149"],["Dark:2079","5_150"],["Dark:2101","5_122"],["Dark:2114","5_151"],["Dark:2248","5_152"],["Dark:2255","5_153"],["Dark:2278","5_177"],["Dark:2283","5_154"],["Dark:2306","5_155"],["Dark:2323","5_123"],["Dark:2384","5_156"],["Dark:2524","5_124"],["Dark:2578","5_157"],["Dark:2591","5_102"],["Dark:2603","5_158"],["Dark:2633","5_159"],["Dark:2637","5_103"],["Dark:2661","5_104"],["Dark:2662","5_105"],["Dark:2697","5_125"],["Dark:2699","5_126"],["Dark:2770","5_160"],["Dark:2775","5_161"],["Dark:2778","5_127"],["Dark:2768","5_128"],["Dark:2807","5_162"],["Dark:2875","5_163"]]);
  const DAGOBAH_RULES_VERSION=32;
  const DAGOBAH_RELEASED=new Map([["Light:30","4_75"],["Light:111","4_16"],["Light:113","4_80"],["Light:149","4_81"],["Light:150","4_17"],["Light:151","4_18"],["Light:155","4_8"],["Light:157","4_19"],["Light:177","4_45"],["Light:236","4_82"],["Light:238","4_83"],["Light:258","4_46"],["Light:297","4_3"],["Light:424","4_47"],["Light:521","4_48"],["Light:597","4_84"],["Light:598","4_85"],["Light:600","4_86"],["Light:601","4_87"],["Light:602","4_88"],["Light:603","4_89"],["Light:708","4_20"],["Light:745","4_21"],["Light:752","4_76"],["Light:780","4_9"],["Light:814","4_49"],["Light:817","4_50"],["Light:838","4_22"],["Light:957","4_23"],["Light:976","4_51"],["Light:1071","4_77"],["Light:1084","4_24"],["Light:1108","4_10"],["Light:1140","4_25"],["Light:1212","4_52"],["Light:1303","4_26"],["Light:1332","4_78"],["Light:1384","4_53"],["Light:1464","4_11"],["Light:1512","4_54"],["Light:1550","4_55"],["Light:1585","4_56"],["Light:1602","4_12"],["Light:1708","4_57"],["Light:1719","4_4"],["Light:1768","4_27"],["Light:1785","4_28"],["Light:1799","4_5"],["Light:1808","4_29"],["Light:1856","4_30"],["Light:1920","4_31"],["Light:1926","4_13"],["Light:1976","4_32"],["Light:2014","4_90"],["Light:2037","4_14"],["Light:2055","4_58"],["Light:2078","4_33"],["Light:2089","4_34"],["Light:2104","4_15"],["Light:2124","4_35"],["Light:2143","4_36"],["Light:2184","4_37"],["Light:2257","4_59"],["Light:2272","4_79"],["Light:2286","4_38"],["Light:2304","4_1"],["Light:2313","4_6"],["Light:2344","4_60"],["Light:2352","4_39"],["Light:2539","4_40"],["Light:2561","4_61"],["Light:2573","4_62"],["Light:2574","4_63"],["Light:2585","4_64"],["Light:2605","4_65"],["Light:2629","4_66"],["Light:2643","4_67"],["Light:2718","4_7"],["Light:2722","4_68"],["Light:2741","4_41"],["Light:2749","4_69"],["Light:2752","4_70"],["Light:2799","4_71"],["Light:2800","4_42"],["Light:2865","4_2"],["Light:2867","4_72"],["Light:2871","4_73"],["Light:2872","4_43"],["Light:2873","4_44"],["Light:2880","4_74"],["Dark:4","4_114"],["Dark:9","4_91"],["Dark:11","4_174"],["Dark:17","4_136"],["Dark:112","4_154"],["Dark:121","4_137"],["Dark:148","4_155"],["Dark:176","4_166"],["Dark:181","4_115"],["Dark:185","4_116"],["Dark:235","4_156"],["Dark:237","4_157"],["Dark:296","4_108"],["Dark:299","4_117"],["Dark:308","4_92"],["Dark:312","4_175"],["Dark:336","4_118"],["Dark:366","4_93"],["Dark:421","4_138"],["Dark:490","4_94"],["Dark:491","4_95"],["Dark:495","4_96"],["Dark:501","4_97"],["Dark:520","4_139"],["Dark:538","4_98"],["Dark:551","4_99"],["Dark:554","4_119"],["Dark:599","4_158"],["Dark:688","4_140"],["Dark:700","4_100"],["Dark:704","4_176"],["Dark:771","4_109"],["Dark:906","4_167"],["Dark:907","4_159"],["Dark:908","4_160"],["Dark:910","4_161"],["Dark:911","4_162"],["Dark:912","4_163"],["Dark:918","4_120"],["Dark:929","4_141"],["Dark:937","4_121"],["Dark:951","4_122"],["Dark:991","4_142"],["Dark:1115","4_123"],["Dark:1150","4_143"],["Dark:1185","4_168"],["Dark:1221","4_124"],["Dark:1244","4_169"],["Dark:1245","4_101"],["Dark:1249","4_177"],["Dark:1251","4_178"],["Dark:1255","4_144"],["Dark:1273","4_102"],["Dark:1450","4_125"],["Dark:1470","4_145"],["Dark:1524","4_103"],["Dark:1538","4_104"],["Dark:1542","4_105"],["Dark:1569","4_126"],["Dark:1583","4_127"],["Dark:1682","4_170"],["Dark:1710","4_128"],["Dark:1718","4_110"],["Dark:1934","4_129"],["Dark:1961","4_179"],["Dark:1967","4_171"],["Dark:2013","4_164"],["Dark:2091","4_146"],["Dark:2123","4_130"],["Dark:2261","4_131"],["Dark:2262","4_147"],["Dark:2281","4_111"],["Dark:2302","4_148"],["Dark:2312","4_112"],["Dark:2343","4_165"],["Dark:2369","4_132"],["Dark:2401","4_149"],["Dark:2518","4_133"],["Dark:2551","4_134"],["Dark:2580","4_150"],["Dark:2597","4_172"],["Dark:2598","4_173"],["Dark:2669","4_151"],["Dark:2677","4_152"],["Dark:2717","4_113"],["Dark:2721","4_135"],["Dark:2728","4_153"],["Dark:2739","4_106"],["Dark:2912","4_107"],["Dark:2915","4_180"]]);
  const SIDES = ['Light', 'Dark'];
  const CARD_TYPES = new Set(['Character', 'Device', 'Effect', 'Interrupt', 'Location', 'Starship', 'Vehicle', 'Weapon']);
  const EDITIONS = Object.freeze({
    [EDITION]: {name: 'Premiere', cardsPerSide: 162},
    [A_NEW_HOPE]: {name: 'A New Hope', cardsPerSide: 81},
    [HOTH]: {name: 'Hoth', cardsPerSide: 81},
    [DAGOBAH]: {name:'Dagobah',cardsPerSide:90},
    [CLOUD_CITY]: {name:'Cloud City',cardsPerSide:90},
    [JABBAS_PALACE]: {name:"Jabba’s Palace",cardsPerSide:90}
  });
  const EXPANSION_TYPES = new Set(['Creature', 'Epic Event']);
  const PLAY_FORMATS = Object.freeze({premiere: [EDITION], 'premiere-a-new-hope': [EDITION, A_NEW_HOPE], 'premiere-a-new-hope-hoth': [EDITION,A_NEW_HOPE,HOTH], 'premiere-a-new-hope-hoth-dagobah':[EDITION,A_NEW_HOPE,HOTH,DAGOBAH], 'premiere-a-new-hope-hoth-dagobah-cloud-city':[EDITION,A_NEW_HOPE,HOTH,DAGOBAH,CLOUD_CITY], 'premiere-a-new-hope-hoth-dagobah-cloud-city-jabbas-palace':[EDITION,A_NEW_HOPE,HOTH,DAGOBAH,CLOUD_CITY,JABBAS_PALACE]});
  const HOTH_RULES_VERSION=31;
  const HOTH_RELEASED=new Map([["Light:5300","3_1"],["Light:109","3_71"],["Light:135","3_28"],["Light:161","3_72"],["Light:167","3_40"],["Light:184","3_32"],["Light:345","3_2"],["Light:498","3_3"],["Light:515","3_73"],["Light:595","3_4"],["Light:615","3_41"],["Light:707","3_5"],["Light:736","3_33"],["Light:793","3_74"],["Light:805","3_34"],["Light:807","3_6"],["Light:808","3_7"],["Light:811","3_29"],["Light:815","3_8"],["Light:889","3_35"],["Light:920","3_42"],["Light:987","3_36"],["Light:1001","3_9"],["Light:1018","3_10"],["Light:1044","3_75"],["Light:1163","3_55"],["Light:1165","3_30"],["Light:5582","3_56"],["Light:1169","3_57"],["Light:1171","3_58"],["Light:1173","3_59"],["Light:1174","3_60"],["Light:5586","3_61"],["Light:5590","3_62"],["Light:5591","3_63"],["Light:1220","3_43"],["Light:1241","3_37"],["Light:1307","3_76"],["Light:1330","3_44"],["Light:1391","3_11"],["Light:1404","3_12"],["Light:1589","3_45"],["Light:1621","3_13"],["Light:1664","3_77"],["Light:1665","3_65"],["Light:1773","3_46"],["Light:1836","3_47"],["Light:1854","3_64"],["Light:1902","3_48"],["Light:1910","3_78"],["Light:1929","3_79"],["Light:1997","3_14"],["Light:1990","3_31"],["Light:2004","3_15"],["Light:2045","3_16"],["Light:2119","3_66"],["Light:2120","3_67"],["Light:2121","3_68"],["Light:2126","3_17"],["Light:2128","3_18"],["Light:2137","3_49"],["Light:2249","3_19"],["Light:2294","3_69"],["Light:2383","3_80"],["Light:2413","3_20"],["Light:2480","3_70"],["Light:2481","3_38"],["Light:2483","3_21"],["Light:2530","3_39"],["Light:2606","3_22"],["Light:2618","3_23"],["Light:2671","3_50"],["Light:2710","3_81"],["Light:2734","3_51"],["Light:2782","3_24"],["Light:2796","3_25"],["Light:2805","3_52"],["Light:2836","3_26"],["Light:2881","3_53"],["Light:2888","3_54"],["Light:2911","3_27"],["Dark:18","3_116"],["Dark:62","3_82"],["Dark:158","3_158"],["Dark:160","3_83"],["Dark:267","3_154"],["Dark:269","3_155"],["Dark:272","3_156"],["Dark:274","3_157"],["Dark:327","3_98"],["Dark:363","3_84"],["Dark:368","3_85"],["Dark:465","3_117"],["Dark:466","3_118"],["Dark:513","3_119"],["Dark:584","3_120"],["Dark:650","3_99"],["Dark:651","3_100"],["Dark:684","3_121"],["Dark:692","3_94"],["Dark:733","3_122"],["Dark:894","3_159"],["Dark:823","3_95"],["Dark:913","3_123"],["Dark:916","3_124"],["Dark:986","3_101"],["Dark:990","3_102"],["Dark:995","3_125"],["Dark:1000","3_86"],["Dark:1029","3_87"],["Dark:1114","3_126"],["Dark:1142","3_103"],["Dark:1162","3_143"],["Dark:6353","3_144"],["Dark:1168","3_145"],["Dark:1170","3_146"],["Dark:1172","3_147"],["Dark:6354","3_148"],["Dark:6358","3_149"],["Dark:6359","3_150"],["Dark:1240","3_104"],["Dark:1226","3_127"],["Dark:1253","3_105"],["Dark:1270","3_106"],["Dark:1272","3_88"],["Dark:1285","3_128"],["Dark:1306","3_160"],["Dark:1521","3_89"],["Dark:1552","3_129"],["Dark:1673","3_107"],["Dark:1706","3_108"],["Dark:1826","3_130"],["Dark:1853","3_151"],["Dark:1869","3_131"],["Dark:1925","3_96"],["Dark:1949","3_97"],["Dark:1950","3_90"],["Dark:1952","3_161"],["Dark:1953","3_132"],["Dark:2098","3_109"],["Dark:2187","3_133"],["Dark:2209","3_134"],["Dark:2266","3_110"],["Dark:2295","3_91"],["Dark:2296","3_92"],["Dark:2339","3_152"],["Dark:2353","3_135"],["Dark:2399","3_136"],["Dark:2422","3_115"],["Dark:2511","3_137"],["Dark:2541","3_111"],["Dark:2572","3_112"],["Dark:2615","3_113"],["Dark:2627","3_138"],["Dark:2645","3_139"],["Dark:2657","3_153"],["Dark:2709","3_162"],["Dark:2732","3_140"],["Dark:2736","3_141"],["Dark:2737","3_93"],["Dark:2772","3_114"],["Dark:2842","3_142"]]);
  const GARRISON_A_NEW_HOPE = new Map([['Dark:654', '2_143'], ['Dark:667', '2_111'], ['Dark:2103', '2_138']]);
  const EXPANSION_RULES_VERSION = 26;
  const A_NEW_HOPE_RELEASED = new Set(['Light:2035', 'Light:2389', 'Light:2418', 'Dark:872', 'Dark:1267',
    'Dark:1340', 'Dark:1588', 'Dark:1697', 'Dark:1700', 'Dark:2094']);
  const A_NEW_HOPE_RULES_27 = new Set(['Light:255', 'Light:318', 'Light:493', 'Light:504', 'Light:527', 'Light:534',
    'Light:751', 'Light:1013', 'Light:1081', 'Light:1183', 'Light:1242', 'Light:1572', 'Light:1606', 'Light:2003',
    'Light:2017', 'Light:2056', 'Light:2059', 'Light:2063', 'Light:2786', 'Light:2857', 'Dark:153', 'Dark:250',
    'Dark:362', 'Dark:611', 'Dark:792', 'Dark:1035', 'Dark:1824', 'Dark:2002', 'Dark:2016', 'Dark:2117', 'Dark:2368',
    'Dark:2604', 'Dark:2683', 'Dark:2687', 'Dark:2715']);
  const A_NEW_HOPE_RULES_28 = new Set(['Light:127', 'Light:282', 'Light:529', 'Light:762', 'Light:819', 'Light:1136', 'Light:1189',
    'Light:1229', 'Light:1377', 'Light:1413', 'Light:1605', 'Light:1668', 'Light:1705', 'Light:1872', 'Light:2151',
    'Light:1752', 'Light:2173', 'Light:2174', 'Light:2222', 'Light:2658', 'Light:2673', 'Light:2916', 'Dark:487', 'Dark:519', 'Dark:626', 'Dark:1198', 'Dark:1275',
    'Dark:1308', 'Dark:1376', 'Dark:1412', 'Dark:1496', 'Dark:1587', 'Dark:1994', 'Dark:1999', 'Dark:2075', 'Dark:2392',
    'Dark:2490', 'Dark:2577', 'Dark:2659', 'Dark:2672']);
  const A_NEW_HOPE_RULES_29 = new Set(["Light:64","Light:100","Light:169","Light:319","Light:385","Light:394","Light:416","Light:509","Light:681","Light:694","Light:943","Light:1047","Light:1062","Light:1214","Light:1298","Light:1507","Light:1674","Light:1619","Light:1987","Light:1992","Light:2006","Light:2048","Light:2050","Light:2061","Light:2082","Light:2125","Light:2165","Light:2298","Light:2308","Light:2563","Light:2611","Light:2802","Light:2824","Light:2908","Light:2851","Light:2892","Dark:67","Dark:223","Dark:227","Dark:508","Dark:605","Dark:657","Dark:670","Dark:687","Dark:729","Dark:891","Dark:1073","Dark:1126","Dark:1200","Dark:1230","Dark:1274","Dark:1284","Dark:1434","Dark:1453","Dark:1478","Dark:1558","Dark:1618","Dark:1640","Dark:1685","Dark:1770","Dark:1844","Dark:1955","Dark:2164","Dark:2290","Dark:2330","Dark:2378","Dark:2438","Dark:2505","Dark:2555","Dark:2596","Dark:2620","Dark:2635","Dark:2754","Dark:2784"]);
  const GARRISON_RIFLE = {id: 'Dark:2915', gempId: '4_180', set: '4'};
  const isGarrisonExpansionCard = card => card?.set === A_NEW_HOPE && GARRISON_A_NEW_HOPE.has(card.id) &&
    GARRISON_A_NEW_HOPE.get(card.id) === card.gempId;
  const isGarrisonRifle = card => card?.id === GARRISON_RIFLE.id && card.gempId === GARRISON_RIFLE.gempId && card.set === GARRISON_RIFLE.set;
  const isReleasedExpansionCard = (card, rulesVersion = Infinity) => card?.set===JABBAS_PALACE&&rulesVersion>=JABBAS_PALACE_RULES_VERSION&&JABBAS_PALACE_RELEASED.get(card.id)===card.gempId || card?.set===CLOUD_CITY&&rulesVersion>=CLOUD_CITY_RULES_VERSION&&CLOUD_CITY_RELEASED.get(card.id)===card.gempId || card?.set===DAGOBAH&&rulesVersion>=DAGOBAH_RULES_VERSION&&DAGOBAH_RELEASED.get(card.id)===card.gempId || card?.set===HOTH&&rulesVersion>=HOTH_RULES_VERSION&&HOTH_RELEASED.get(card.id)===card.gempId || isGarrisonExpansionCard(card) ||
    card?.set === A_NEW_HOPE && (rulesVersion >= EXPANSION_RULES_VERSION && A_NEW_HOPE_RELEASED.has(card.id) ||
      rulesVersion >= 27 && A_NEW_HOPE_RULES_27.has(card.id) || rulesVersion >= 28 && A_NEW_HOPE_RULES_28.has(card.id) || rulesVersion >= 29 && A_NEW_HOPE_RULES_29.has(card.id));
  const VALUE_FIELDS = ['power', 'ability', 'deploy', 'forfeit', 'destiny', 'armor', 'maneuver', 'hyperspeed', 'landspeed', 'parsec', 'lightSideIcons', 'darkSideIcons'];
  const BASIC_WEAPONS = new Map([
    ['Light:259', {cost: 1, bonus: 0}], // Blaster
    ['Light:265', {cost: 2, bonus: 1}], // Blaster Rifle
    ['Dark:264', {cost: 2, bonus: 1}],  // Blaster Rifle
    ['Dark:1264', {cost: 1, bonus: 0}]  // Imperial Blaster
  ]);

  function readCardValue(raw) {
    if (raw == null) return {kind: 'missing', value: null, raw: null};
    if (typeof raw !== 'number' && typeof raw !== 'string') return {kind: 'unknown', value: null, raw};
    const token = String(raw).trim();
    if (/^\d+$/.test(token) && Number.isSafeInteger(Number(token))) return {kind: 'number', value: Number(token), raw};
    if (/^(?:\*+|X|[¼½¾π])$/i.test(token)) return {kind: 'special', value: null, raw};
    return {kind: 'unknown', value: null, raw};
  }

  function locationTitle(card) {
    return String(card.name ?? '').trim().replace(/^[•*]+\s*/, '').toLowerCase();
  }

  function isDeployableCharacter(card) {
    return /character/i.test(card.type || '') && (card.id==='Light:319'||Number.isFinite(card.deploy) && card.deploy >= 0);
  }

  function basicWeaponRule(card) {
    return card?.type === 'Weapon' && card.subType === 'Character' ? BASIC_WEAPONS.get(card.id) : undefined;
  }

  function isBantha(card) {
    return card?.type === 'Vehicle' && ['Dark:191','Light:2125'].includes(card.id) && /Bantha ability = (?:½|½)/.test(card.gametext || '');
  }

  function permanentPilotAbility(card) {
    if (!['Starship','Vehicle'].includes(card?.type) || card.pilotsEjected) return null;
    if(['Light:2908','Dark:2596','Dark:906'].includes(card.id))return 3;
    const wording = [A_NEW_HOPE,HOTH,DAGOBAH,CLOUD_CITY,JABBAS_PALACE].includes(card.set) ? /\bPermanent pilot(?: aboard)? provides ability of ([1-9]\d*)\./i :
      /\bPermanent pilot aboard provides ability of ([1-9]\d*)\./i;
    const ability = String(card.gametext || '').match(wording);
    return ability ? Number(ability[1]) : null;
  }

  function checkedStrings(value, label) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || !entry.trim())) {
      throw new Error(label + ' muss eine Liste aus Texten sein.');
    }
    return value.slice();
  }

  function checkedText(value, label) {
    if (value == null) return null;
    if (typeof value !== 'string') throw new Error(label + ' muss Text sein.');
    return value;
  }

  function checkedImage(value, label) {
    const url = checkedText(value, label);
    if (url !== null && !/^https:\/\/res\.starwarsccg\.org\//.test(url)) throw new Error(label + ' muss von res.starwarsccg.org stammen.');
    return url;
  }

  function normalizeCard(record, edition = EDITION) {
    const {id, side, set, sourceId, gempId, rawFront: front} = record ?? {};
    if (!SIDES.includes(side) || set !== edition || !Number.isSafeInteger(sourceId) || sourceId < 1 || id !== side + ':' + sourceId ||
        !new RegExp('^' + edition + '_\\d+$').test(gempId ?? '')) {
      throw new Error('Ungültige Edition, Kartenseite oder Karten-ID: ' + (id ?? 'fehlt'));
    }
    const supportedType = CARD_TYPES.has(front?.type) || [A_NEW_HOPE,HOTH,DAGOBAH,CLOUD_CITY,JABBAS_PALACE].includes(edition) && (EXPANSION_TYPES.has(front?.type)||edition===DAGOBAH&&/^Jedi Test #[1-5]$/.test(front?.type));
    if (!front || typeof front.title !== 'string' || !front.title.trim() || !supportedType) {
      throw new Error(id + ' hat keinen gültigen Namen oder Kartentyp.');
    }
    const flags = checkedStrings(front.icons, id + ' · Icons');
    const values = Object.fromEntries(VALUE_FIELDS.map(field => [field, readCardValue(front[field])]));
    for (const field of ['lightSideIcons', 'darkSideIcons']) {
      if (values[field].value > 8) values[field] = {kind: 'unknown', value: null, raw: values[field].raw};
    }
    const numbers = Object.fromEntries(VALUE_FIELDS.map(field => [field, values[field].value]));
    const errataSymbol = checkedText(front.errataSymbol, id + ' · Errata');
    const errataImage = checkedImage(front.printableSlipUrl, id + ' · Slip');
    const validErrataSymbol = ['E1', 'D-E1'].includes(errataSymbol) || edition === A_NEW_HOPE && errataSymbol === 'D-E2';
    // The pinned entry for Besieged marks its E1 slip as VIRTUAL despite the linked errata asset.
    const besiegedSlip = edition === A_NEW_HOPE && id === 'Dark:223' && errataSymbol === 'E1' &&
      front.printableSlipType === 'VIRTUAL' && errataImage?.endsWith('/Beseiged (Errata)/image.png');
    // This exact pinned Hoth entry documents a text erratum but supplies no slip asset.
    const textOnlyArtillery = edition === HOTH && id === 'Light:135' && errataSymbol === 'E1' &&
      front.errataDate === '2023-10-07' && record.preErrata?.sourceId === 40034 &&
      front.errataNotes === 'Clarifies that the Warrior with the remote is firing the weapons remotely.' &&
      !errataImage && front.printableSlipType == null;
    // This exact public JP entry has an E1 marker but no published slip.
    const textOnlyRescue=edition===JABBAS_PALACE&&id==='Light:2300'&&gempId==='6_75'&&errataSymbol==='E1'&&!errataImage&&front.printableSlipType==null&&front.gametext==="If Han was just lost and Leia is on table (or vice versa), place the just lost character on your Used Pile instead. OR If Leia is present at a site where Han is captive, release Han. OR Cancel a Force drain at a prison.";
    if (errataSymbol && !textOnlyArtillery && !textOnlyRescue && (!validErrataSymbol || !errataImage || (front.printableSlipType !== 'ERRATA' && !besiegedSlip))) {
      throw new Error(id + ' hat ein Erratum ohne zugehörigen Korrekturslip oder einen unbekannten Marker.');
    }
    if (front.uniqueness != null && !(/^\*+$/.test(front.uniqueness)||[DAGOBAH,CLOUD_CITY,JABBAS_PALACE].includes(edition)&&/^(?:<>){1,3}$/.test(front.uniqueness))) throw new Error(id + ' hat ein unbekanntes Einzigartigkeitszeichen.');
    const genericLimit=front.uniqueness?.includes('<>')?front.uniqueness.length/2:null;
    const uniquenessLimit = (genericLimit?null:front.uniqueness?.length) ?? front.title.match(/^•+/)?.[0].length ?? null;
    const destinyValues = front.destinyValues ?? [];
    const validDestiny = value => Number.isSafeInteger(value) && value >= 0 ||
      edition === A_NEW_HOPE && front.destiny === 'π' && Number.isFinite(value) && value > 0;
    if (!Array.isArray(destinyValues) || !destinyValues.every(validDestiny)) {
      throw new Error(id + ' hat eine ungültige Liste gedruckter Destiny-Werte.');
    }
    const texts = {
      print: checkedText(record.printText, id + ' · Originaldruck'),
      active: checkedText(front.gametext, id + ' · Spieltext'),
      lore: checkedText(front.lore, id + ' · Lore'),
      explanationDe: checkedText(record.explanationDe, id + ' · Deutsche Erklärung'),
      preErrata: checkedText(record.preErrata?.gametext, id + ' · ältere Textfassung')
    };
    const images = {print: checkedImage(front.imageUrl, id + ' · Kartenscan'), slip: errataImage};
    if (texts.print !== null && (!images.print || record.printSource !== images.print)) {
      throw new Error(id + ' hat eine Drucktranskription ohne den zugehörigen Scan.');
    }
    if (record.preErrata && (!Number.isSafeInteger(record.preErrata.sourceId) || texts.preErrata === null)) {
      throw new Error(id + ' hat eine unvollständige Vor-Errata-Fassung.');
    }
    return {
      id, side, set, gempId, name: front.title, type: front.type, subType: checkedText(front.subType, id + ' · Untertyp') ?? '',
      personas: checkedStrings(record.personas, id + ' · Personas'),
      characteristics: checkedStrings(front.characteristics, id + ' · Merkmale'),
      extraText: checkedStrings(front.extraText, id + ' · Zusatztext'),
      uniquenessLimit, genericLimit, values, ...numbers, destinyValues: destinyValues.slice(), cardIcons: flags,
      warrior: flags.some(flag=>/^Warrior(?: x[2-9])?$/.test(flag)), pilot: flags.includes('Pilot'), navComputer: flags.includes('Nav Computer'),
      locationTags: front.type === 'Location' ? flags : [],
      icons: {light: numbers.lightSideIcons, dark: numbers.darkSideIcons},
      texts, images, errataSymbol, errataDate: checkedText(front.errataDate, id + ' · Errata-Datum'),
      errataNote: checkedText(front.errataNotes, id + ' · Errata-Hinweis'), preErrataSourceId: record.preErrata?.sourceId ?? null,
      gametext: texts.active ?? '', lore: texts.lore ?? '', image: images.print ?? ''
    };
  }

  function readCatalog(snapshot, edition = EDITION) {
    if (!Object.hasOwn(EDITIONS, edition)) throw new Error('Unbekannte Kartenedition ' + edition + '.');
    const {name, cardsPerSide} = EDITIONS[edition];
    if (snapshot?.schema !== 2 || snapshot.source !== SOURCE || snapshot.revision !== REVISION || snapshot.edition !== edition ||
        !Array.isArray(snapshot.cards) || snapshot.cards.length !== cardsPerSide * SIDES.length) {
      throw new Error(`Ungültiger ${name}-Snapshot. Erwartet sind ${cardsPerSide * SIDES.length} Karten der festgeschriebenen Revision.`);
    }
    const cards = snapshot.cards.map(record => normalizeCard(record, edition));
    if (new Set(cards.map(card => card.id)).size !== cards.length || new Set(cards.map(card => card.gempId)).size !== cards.length) {
      throw new Error('Doppelte Karten- oder Gemp-IDs in der ' + name + '-Datenbank.');
    }
    for (const side of SIDES) {
      if (cards.filter(card => card.side === side).length !== cardsPerSide) throw new Error(`${side} muss im ${name}-Snapshot genau ${cardsPerSide} Karten enthalten.`);
    }
    return cards;
  }

  function readSupplementalCards(payload) {
    if (payload?.schema !== 1 || payload.source !== SOURCE || payload.revision !== REVISION ||
        !isGarrisonRifle(payload.card)) {
      throw new Error('Ungültiger Datensatz für Zuckuss’ Fanggewehr.');
    }
    const expected = new Map(GARRISON_A_NEW_HOPE);
    const additions = (payload.additions ?? []).map(record => {
      if (!isGarrisonExpansionCard(record) || !expected.has(record.id)) throw new Error('Unbekannte Zusatzkarte aus A New Hope.');
      expected.delete(record.id);
      return normalizeCard(record, A_NEW_HOPE);
    });
    return [normalizeCard(payload.card, '4'), ...additions];
  }

  const isLostPileEffect = card => card?.id === 'Light:917' || card?.id === 'Dark:2897';

  function isPlayableStarterCard(card) {
    if([CLOUD_CITY,JABBAS_PALACE].includes(card.set))return isReleasedExpansionCard(card);
    if(card.set===DAGOBAH)return isReleasedExpansionCard(card);
    if(card.set===HOTH)return isReleasedExpansionCard(card);
    if(card.set===A_NEW_HOPE&&isReleasedExpansionCard(card))return true;
    if (card.type === 'Location') return Number.isInteger(card.icons.light) && Number.isInteger(card.icons.dark);
    if (card.type === 'Weapon' || isLostPileEffect(card) ||
      ['Light:735','Dark:734','Dark:1880','Dark:262','Light:997','Dark:996','Light:2435','Dark:2360','Dark:1939','Light:664','Light:1429','Dark:489',
       'Light:95','Dark:94','Light:2217','Dark:2216','Light:348','Dark:347','Light:2100','Dark:2099','Dark:777','Light:1870',
       'Light:2514','Dark:1831','Light:1778','Dark:2373','Light:2102','Dark:2833','Light:2277','Dark:613','Light:2625','Dark:2029',
       'Light:1039','Dark:2357','Dark:1555','Dark:1691','Dark:391','Light:2297','Light:2531','Light:2740','Light:1389','Dark:621',
       'Light:994','Light:1455','Dark:1576','Dark:1578','Dark:2701','Light:1104','Light:1874','Dark:1215','Dark:2406','Dark:2634',
       'Light:1196','Light:2705','Dark:1064','Light:826','Dark:190','Light:2157','Dark:1430','Light:2141',
       'Light:68','Dark:1208','Light:695','Light:1380','Dark:1378','Light:1373','Dark:1372','Light:821','Dark:1617',
       'Dark:1579','Dark:2176','Light:2011','Dark:2632','Dark:2650',
       'Light:352','Light:468','Dark:649','Light:985','Dark:467',
       'Light:24','Dark:622','Light:1120','Light:2423','Light:2325','Light:1810','Light:1707','Light:1755','Light:1197',
       'Light:2033','Dark:1263','Light:2041','Light:2110','Dark:914','Light:2860','Dark:665','Dark:932','Dark:304','Light:781',
       'Light:761','Dark:2884','Light:1236','Light:1331','Dark:1338','Light:38','Dark:22','Light:222','Light:2764','Dark:2762',
       'Light:483','Dark:1932','Light:758','Light:1749','Dark:824','Light:1321','Dark:253','Dark:993',
       'Light:882','Dark:888','Light:1827','Dark:1440','Dark:1237','Light:1893','Dark:830','Light:2043','Dark:1282',
       'Dark:1480','Dark:2214','Dark:2397','Light:1402','Dark:1688','Light:1554','Light:1643',
       'Dark:2242','Dark:2410','Dark:1904','Dark:1767','Dark:2901','Dark:1238',
       'Light:2180','Dark:1265','Light:1187','Light:2319','Light:2509',
       'Light:1913','Light:2646','Dark:1599','Dark:1401','Dark:619','Dark:266','Dark:1815',
       'Light:1834','Light:1794','Light:2689','Dark:2688','Light:1125','Light:2570','Dark:1565','Light:585','Light:2863',
       'Dark:1857','Light:215','Dark:667','Dark:2103',
       'Light:1102','Light:1500','Light:1600','Light:2105','Dark:2528', // Named retrieval and Reserve Deck search
       'Light:2385','Dark:575','Dark:2517','Dark:643','Dark:1697','Light:534','Light:1572','Dark:153',
       'Light:255','Light:282','Light:762','Light:819','Light:1081','Light:1136','Light:1183','Light:1229','Light:1605','Light:1668','Light:1872',
       'Light:2056','Light:2151','Light:2174','Light:2222','Light:2673',
       'Dark:487','Dark:626','Dark:1035','Dark:1198','Dark:1275','Dark:1308','Dark:2368','Dark:2392','Dark:2577','Dark:2672'].includes(card.id)) return true;
    return Number.isInteger(card.deploy) && card.deploy >= 0 && (isDeployableCharacter(card) || ['Vehicle','Starship'].includes(card.type));
  }

  function buildStarterDeck(side, definition, byId, {format, cardRulesVersion}) {
    const error = message => new Error(side + '-Starterdeck: ' + message);
    if (format !== undefined && !Object.hasOwn(PLAY_FORMATS, format)) throw error('Unbekanntes Spielformat ' + format + '.');
    if (!Array.isArray(definition?.cards) || !Array.isArray(definition.startingLocations)) {
      throw error('Kartenliste oder Starting Locations fehlen.');
    }
    const cards = [], ids = new Set();
    for (const entry of definition.cards) {
      const {id, count} = entry ?? {}, card = byId.get(id);
      if (!card || card.side !== side) throw error('Unbekannte oder seitenfremde Karte ' + id + '.');
      const supportedEdition = format === undefined ? card.set === EDITION ||
        definition.theme?.id === 'imperiale-garnison' && (isGarrisonRifle(card) || isGarrisonExpansionCard(card)) :
        PLAY_FORMATS[format].includes(card.set);
      if (!supportedEdition) {
        throw error(id + ' stammt aus einer anderen Edition.');
      }
      if ([A_NEW_HOPE,HOTH,DAGOBAH,CLOUD_CITY,JABBAS_PALACE].includes(card.set) && !isReleasedExpansionCard(card, cardRulesVersion)&&!(format===undefined&&isGarrisonRifle(card))) throw error(id + ' ist noch nicht für das Spiel freigegeben (Regelstand).');
      if (ids.has(id)) throw error('Doppelter Eintrag für ' + id + '.');
      if (!Number.isInteger(count) || count < 1 || count > 60) throw error('Ungültige Kartenanzahl für ' + id + '.');
      if (!isPlayableStarterCard(card)) throw error(card.name + ' kann im aktuellen Lernmodus nicht ausgespielt werden.');
      ids.add(id);
      // Uniqueness limits cards on the table. Decks may include additional copies.
      for (let i = 0; i < count; i++) cards.push(card);
    }
    if (cards.length !== 60) throw error('Erwartet sind 60 Karten, gefunden wurden ' + cards.length + '.');
    const starts = definition.startingLocations.map(id => {
      const card = ids.has(id) ? byId.get(id) : null;
      if (card?.type !== 'Location') throw error('Ungültige Starting Location ' + id + '.');
      return card;
    });
    if (new Set(starts.map(locationTitle)).size !== starts.length) throw error('Die Starting Locations müssen unterschiedliche Namen haben.');
    const startingIndices = starts.flatMap(card => cards.flatMap((copy, index) => copy === card ? [index] : []));
    if (format !== undefined && !startingIndices.length) throw error('Mindestens eine Starting Location erforderlich.');
    const deck = {cards, startingIndices};
    if (definition.strategy !== undefined) {
      const fields = ['start', 'opening', 'tactics'];
      if (!fields.every(field => typeof definition.strategy?.[field] === 'string' && definition.strategy[field].trim())) {
        throw error('Die Strategie benötigt einen Startort, einen Aufbau und Schlüsselzüge.');
      }
      deck.strategy = Object.fromEntries(fields.map(field => [field, definition.strategy[field]]));
    }
    if (definition.theme === undefined) return deck;
    const {id, name, description} = definition.theme ?? {};
    if (typeof id !== 'string' || !/^[a-z]+(?:-[a-z]+)*$/.test(id) || id === 'starter' ||
        typeof name !== 'string' || !name.trim() || typeof description !== 'string' || !description.trim()) {
      throw error('Ungültige Angaben zum Themendeck.');
    }
    if (!startingIndices.length) throw error('Ein Themendeck benötigt mindestens eine Starting Location.');
    return {...deck, theme: {id, name, description}};
  }

  function readStarterDecks(payload, catalog, options = {}) {
    if (payload?.schema !== 1) throw new Error('Unbekanntes Format der Premiere-Starterdecks.');
    const byId = new Map(catalog.map(card => [card.id, card]));
    if (byId.size !== catalog.length) throw new Error('Die Premiere-Kartendatenbank enthält doppelte Karten-IDs.');
    return {
      light: buildStarterDeck('Light', payload.decks?.Light, byId, options),
      dark: buildStarterDeck('Dark', payload.decks?.Dark, byId, options)
    };
  }

  function readThemedDecks(payload, catalog, options = {}) {
    if (payload?.schema !== 1) throw new Error('Unbekanntes Format der Premiere-Themendecks.');
    const byId = new Map(catalog.map(card => [card.id, card]));
    return Object.fromEntries(SIDES.map(side => {
      const definitions = payload.decks?.[side];
      if (!Array.isArray(definitions) || definitions.length === 0) {
        throw new Error(side + ' benötigt mindestens ein Premiere-Themendeck.');
      }
      const choices = definitions.map(definition => ({definition, deck: buildStarterDeck(side, definition, byId, options)}));
      const ids = new Set(choices.map(({deck}) => deck.theme?.id));
      if (ids.has(undefined) || ids.size !== choices.length) throw new Error(side + ': Die Themendecks benötigen eindeutige IDs.');
      return [side.toLowerCase(), choices];
    }));
  }

  function readFormatDeckChoices(format, starters, themes, variants, catalog) {
    if (themes?.schema !== 1 || variants?.schema !== 1 || !Object.hasOwn(PLAY_FORMATS, format) || !variants.formats?.[format]) {
      throw new Error('Ungültige Deckvarianten für ' + format + '.');
    }
    const definitions = Object.fromEntries(SIDES.map(side => {
      const byTheme = new Map((format.startsWith('premiere-a-new-hope-hoth')?[]:themes.decks[side]).map(definition => [definition.theme.id, definition]));
      for (const definition of variants.formats[format][side]) byTheme.set(definition.theme.id, definition);
      return [side, [...byTheme.values()]];
    }));
    const fixed = readStarterDecks(starters, catalog, {format});
    const themed = readThemedDecks({schema: 1, decks: definitions}, catalog, {format});
    return Object.fromEntries(SIDES.map(side => {
      const key = side.toLowerCase();
      return [key, [{deck: fixed[key], definition: starters.decks[side]}, ...themed[key]]];
    }));
  }

  function buildAudit(catalog, decks) {
    const errata = catalog.filter(card => card.errataSymbol).map(card => ({
      id: card.id,
      name: card.name,
      marker: card.errataSymbol,
      date: card.errataDate,
      sourceNote: card.errataNote,
      activeText: 'pinned-front',
      decision: 'accepted-as-reference-text',
      slip: card.images.slip,
      printScan: card.images.print,
      hasTranscribedPrintText: card.texts.print !== null,
      preErrataSourceId: card.preErrataSourceId
    }));
    return {
      source: SOURCE,
      revision: REVISION,
      edition: EDITION,
      cards: Object.fromEntries(SIDES.map(side => [side, catalog.filter(card => card.side === side).length])),
      cardsWithPrintScan: catalog.filter(card => card.images.print).length,
      transcribedPrintTexts: catalog.filter(card => card.texts.print !== null).length,
      openPrintTexts: catalog.filter(card => card.texts.print === null).map(card => ({
        id: card.id, name: card.name, printScan: card.images.print
      })),
      preErrataTexts: catalog.filter(card => card.texts.preErrata !== null).length,
      values: Object.fromEntries(VALUE_FIELDS.map(field => {
        const counts = {number: 0, missing: 0, special: 0, unknown: 0};
        for (const card of catalog) counts[card.values[field].kind]++;
        return [field, counts];
      })),
      decks: Object.fromEntries(SIDES.map(side => {
        const deck = decks[side.toLowerCase()];
        return [side, {cards: deck.cards.length, startingLocations: [...new Set(deck.startingIndices.map(index => deck.cards[index].id))]}];
      })),
      errata
    };
  }

  return {SOURCE, REVISION, EDITION, A_NEW_HOPE, HOTH, DAGOBAH,DAGOBAH_RULES_VERSION,CLOUD_CITY,CLOUD_CITY_RULES_VERSION,JABBAS_PALACE,JABBAS_PALACE_RULES_VERSION, EDITIONS, SIDES, PLAY_FORMATS, EXPANSION_RULES_VERSION,HOTH_RULES_VERSION,
    readCatalog, readSupplementalCards, readStarterDecks, readThemedDecks, readFormatDeckChoices,
    readCardValue, locationTitle, isDeployableCharacter, basicWeaponRule, isBantha, isLostPileEffect, permanentPilotAbility,
    isGarrisonExpansionCard, isReleasedExpansionCard, buildAudit};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PremiereData;
