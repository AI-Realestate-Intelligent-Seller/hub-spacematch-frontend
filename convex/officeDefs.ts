// Office address, one source for the whole Hub (client pages, emails, decks, mailers, Lob return address).
// Evanston since 2026-11-12: Cris asked for it on the Hub and confirmed Michael's OK. Before that: 676 N Michigan Ave #3010, Chicago.
export const OFFICE_LINE1 = "2822 Central St.";
export const OFFICE_CITY = "Evanston";
export const OFFICE_STATE = "IL";
export const OFFICE_ZIP = "60201";
/** "2822 Central St., Evanston" (short form for labels) */
export const OFFICE_SHORT = `${OFFICE_LINE1}, ${OFFICE_CITY}`;
/** "2822 Central St., Evanston, IL 60201" */
export const OFFICE_ADDRESS = `${OFFICE_SHORT}, ${OFFICE_STATE} ${OFFICE_ZIP}`;
