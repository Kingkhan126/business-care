/** Wait for invoice images before opening the shared browser print / Save as PDF flow. */
export async function printInvoice() {
  const images = Array.from(document.querySelectorAll<HTMLImageElement>("#invoice-printable-area img"));
  await Promise.all(images.map(image => new Promise<void>(resolve => {
    if (image.complete) return resolve();
    const finish = () => {
      clearTimeout(timeout);
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      resolve();
    };
    const timeout = setTimeout(finish, 5000);
    image.addEventListener("load", finish);
    image.addEventListener("error", finish);
    if (image.complete) finish();
  })));
  // Flush React's image-load/error update before the browser takes its print snapshot.
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  window.print();
}
