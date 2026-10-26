/** Телефон определяется один раз при запуске: окна там нет, поэтому вместо titlebar нижняя панель навигации. */
export const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
