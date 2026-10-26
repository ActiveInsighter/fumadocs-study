export type HomeSubject = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  href: string;
  icon: 'math' | 'computer' | 'english' | 'politics' | 'code';
  topics: readonly [string, string, string];
  previewTitle: string;
  previewDescription: string;
  sections: readonly [
    { title: string; description: string; href: string },
    { title: string; description: string; href: string },
    { title: string; description: string; href: string },
  ];
  formula?: string;
};

export const homeSubjects: readonly HomeSubject[] = [
  {
    id: 'math',
    name: '考研数学',
    shortName: '数学',
    description: '从概念到公式，从题型到解法，把零散知识连成清晰的数学体系。',
    href: '/docs/math/',
    icon: 'math',
    topics: ['公式手册', '思维导图', '解题方法'],
    previewTitle: '让每一步推导，都有来处。',
    previewDescription: '围绕高等数学、线性代数与概率论，建立知识、公式和方法之间的联系。',
    sections: [
      { title: '思维导图', description: '梳理三大科目的概念与知识结构。', href: '/docs/math/mind-maps/' },
      { title: '公式手册', description: '快速查找三大科目的常用公式。', href: '/docs/math/formulas/' },
      { title: '解题方法', description: '结合典型题目理解推导与解法。', href: '/docs/math/解题方法/' },
    ],
    formula: '∫ f(x) dx = F(x) + C',
  },
  {
    id: '408',
    name: '计算机 408',
    shortName: '408',
    description: '从数据如何组织，到指令如何执行，系统理解计算机的每一层。',
    href: '/docs/408/',
    icon: 'computer',
    topics: ['四门课程', '题型总结', '真题试卷'],
    previewTitle: '把计算机知识，连成一个整体。',
    previewDescription: '数据结构、计算机组成原理、操作系统与计算机网络，在同一套目录中复习。',
    sections: [
      { title: '知识点总结 2', description: '四门课程的优化版完整讲义。', href: '/docs/408/knowledge2/' },
      { title: '408题型总结', description: '按章节整理考点、例题与训练解析。', href: '/docs/408/question-summary/' },
      { title: '真题与试卷', description: '通过历年真题与套卷检验掌握程度。', href: '/docs/408/exam/' },
    ],
  },
  {
    id: 'english',
    name: '考研英语',
    shortName: '英语',
    description: '从高频词汇开始，在释义、例句与语境中积累稳定的理解。',
    href: '/docs/english/',
    icon: 'english',
    topics: ['核心词卡', '补充词汇', '短语搭配'],
    previewTitle: 'Every word, in context.',
    previewDescription: '按学习单元复习词汇与短语，通过音标、义项和例句理解实际用法。',
    sections: [
      { title: '考研英语词卡', description: '按重要性顺序积累核心词汇。', href: '/docs/english/vocabulary/' },
      { title: '其他词频词卡', description: '补充阅读与写作中常见的词汇。', href: '/docs/english/supplement-vocabulary/' },
      { title: '考研短语卡片', description: '掌握常见搭配、句型与语境。', href: '/docs/english/phrases/' },
    ],
  },
  {
    id: 'politics',
    name: '考研政治',
    shortName: '政治',
    description: '沿着课程框架理解考点，用知识总结和题目分析巩固每一章。',
    href: '/docs/politics/',
    icon: 'politics',
    topics: ['专题复习', '背诵笔记', '帽子题'],
    previewTitle: '先建框架，再记住细节。',
    previewDescription: '将五大模块的知识讲解、易混点与复习框架整理在一起。',
    sections: [
      { title: '专题复习', description: '梳理概念、时间线与易混选项。', href: '/docs/politics/special-review/' },
      { title: '肖1000背诵笔记', description: '集中复习核心考点与易混辨析。', href: '/docs/politics/xiao-1000-notes/' },
      { title: '27肖帽子题背诵版', description: '按五大科目背诵要点并折叠自测。', href: '/docs/politics/27肖帽子题背诵版/' },
    ],
  },
  {
    id: 'algorithm',
    name: '算法学习笔记',
    shortName: '算法',
    description: '从复杂度分析到动态规划，循序理解数据结构与经典算法范式。',
    href: '/docs/algorithm/',
    icon: 'code',
    topics: ['数据结构', '算法范式', '专题复盘'],
    previewTitle: '理解一种方法，解开一类问题。',
    previewDescription: '沿着基础数据结构、核心算法范式与综合专题，逐步建立解题方法。',
    sections: [
      { title: '时间复杂度与大 O', description: '用复杂度判断算法的适用范围。', href: '/docs/algorithm/01-basics/01-时间复杂度与大-O-表示法/' },
      { title: '数组与存储', description: '从连续内存理解数组的特性。', href: '/docs/algorithm/02-array/01-数组理论基础-连续内存、随机访问与二维布局/' },
      { title: '动态规划基础', description: '掌握状态、递推与计算顺序。', href: '/docs/algorithm/11-dynamic-programming/01-动态规划理论基础/' },
    ],
  },
];
