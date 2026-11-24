export type PlaybookLink = { label: string; to?: string; href?: string };
export type PlaybookSection = {
  h: string;
  items: string[];
  links?: PlaybookLink[];
};
export type Playbook = {
  id: string;
  n: number;
  title: string;
  who: string;
  minutes: number;
  summary: string;
  tags: string;
  sections: PlaybookSection[];
};
