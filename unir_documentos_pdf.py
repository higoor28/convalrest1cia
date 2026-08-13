import os
import sys
import tkinter as tk
from tkinter import filedialog, messagebox

try:
    from PIL import Image, ImageOps
except ImportError:
    Image = None
    ImageOps = None


SUPPORTED_TYPES = (
    ("Imagens", "*.jpg *.jpeg *.png *.bmp *.tif *.tiff *.webp"),
    ("Todos os arquivos", "*.*"),
)


class PhotoToPdfApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Unir fotos de documentos em PDF")
        self.root.geometry("780x520")
        self.root.minsize(680, 420)

        self.files = []
        self.output_path = tk.StringVar()

        self._build_ui()

        if Image is None:
            messagebox.showerror(
                "Biblioteca ausente",
                "A biblioteca Pillow nao esta instalada.\n\n"
                "Instale com:\npython -m pip install pillow",
            )

    def _build_ui(self):
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(1, weight=1)

        header = tk.Frame(self.root, padx=16, pady=14)
        header.grid(row=0, column=0, sticky="ew")
        header.columnconfigure(0, weight=1)

        title = tk.Label(
            header,
            text="Unir fotos de documentos em PDF",
            font=("Segoe UI", 16, "bold"),
            anchor="w",
        )
        title.grid(row=0, column=0, sticky="ew")

        subtitle = tk.Label(
            header,
            text="Adicione as fotos na ordem desejada. Cada imagem vira uma pagina do PDF.",
            font=("Segoe UI", 10),
            anchor="w",
        )
        subtitle.grid(row=1, column=0, sticky="ew", pady=(4, 0))

        body = tk.Frame(self.root, padx=16)
        body.grid(row=1, column=0, sticky="nsew")
        body.columnconfigure(0, weight=1)
        body.rowconfigure(0, weight=1)

        list_frame = tk.Frame(body)
        list_frame.grid(row=0, column=0, sticky="nsew")
        list_frame.columnconfigure(0, weight=1)
        list_frame.rowconfigure(0, weight=1)

        self.listbox = tk.Listbox(
            list_frame,
            selectmode=tk.EXTENDED,
            font=("Segoe UI", 10),
            activestyle="dotbox",
        )
        self.listbox.grid(row=0, column=0, sticky="nsew")

        scrollbar = tk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.listbox.yview)
        scrollbar.grid(row=0, column=1, sticky="ns")
        self.listbox.configure(yscrollcommand=scrollbar.set)

        controls = tk.Frame(body, padx=12)
        controls.grid(row=0, column=1, sticky="ns")

        tk.Button(controls, text="Adicionar fotos", width=18, command=self.add_files).pack(pady=(0, 8))
        tk.Button(controls, text="Remover", width=18, command=self.remove_selected).pack(pady=8)
        tk.Button(controls, text="Subir", width=18, command=lambda: self.move_selected(-1)).pack(pady=8)
        tk.Button(controls, text="Descer", width=18, command=lambda: self.move_selected(1)).pack(pady=8)
        tk.Button(controls, text="Limpar lista", width=18, command=self.clear_files).pack(pady=8)

        footer = tk.Frame(self.root, padx=16, pady=14)
        footer.grid(row=2, column=0, sticky="ew")
        footer.columnconfigure(1, weight=1)

        tk.Label(footer, text="Salvar PDF em:", font=("Segoe UI", 10)).grid(row=0, column=0, sticky="w")
        tk.Entry(footer, textvariable=self.output_path, font=("Segoe UI", 10)).grid(
            row=0, column=1, sticky="ew", padx=8
        )
        tk.Button(footer, text="Escolher...", command=self.choose_output).grid(row=0, column=2)

        tk.Button(
            footer,
            text="Gerar PDF",
            font=("Segoe UI", 10, "bold"),
            command=self.generate_pdf,
            height=2,
        ).grid(row=1, column=0, columnspan=3, sticky="ew", pady=(12, 0))

    def add_files(self):
        selected = filedialog.askopenfilenames(title="Escolha as fotos", filetypes=SUPPORTED_TYPES)
        for path in selected:
            if path not in self.files:
                self.files.append(path)
        self.refresh_list()

        if selected and not self.output_path.get():
            folder = os.path.dirname(selected[0])
            self.output_path.set(os.path.join(folder, "documentos_unidos.pdf"))

    def remove_selected(self):
        selected_indexes = list(self.listbox.curselection())
        for index in reversed(selected_indexes):
            del self.files[index]
        self.refresh_list()

    def clear_files(self):
        self.files.clear()
        self.refresh_list()

    def move_selected(self, direction):
        selected_indexes = list(self.listbox.curselection())
        if not selected_indexes:
            return

        if direction < 0:
            indexes = selected_indexes
        else:
            indexes = list(reversed(selected_indexes))

        moved_indexes = []
        for index in indexes:
            new_index = index + direction
            if new_index < 0 or new_index >= len(self.files):
                moved_indexes.append(index)
                continue
            self.files[index], self.files[new_index] = self.files[new_index], self.files[index]
            moved_indexes.append(new_index)

        self.refresh_list()
        for index in moved_indexes:
            self.listbox.selection_set(index)

    def choose_output(self):
        path = filedialog.asksaveasfilename(
            title="Salvar PDF",
            defaultextension=".pdf",
            filetypes=(("PDF", "*.pdf"), ("Todos os arquivos", "*.*")),
        )
        if path:
            self.output_path.set(path)

    def refresh_list(self):
        self.listbox.delete(0, tk.END)
        for index, path in enumerate(self.files, start=1):
            self.listbox.insert(tk.END, f"{index:02d}. {os.path.basename(path)}")

    def generate_pdf(self):
        if Image is None:
            messagebox.showerror("Erro", "Instale o Pillow antes de gerar o PDF.")
            return

        if not self.files:
            messagebox.showwarning("Nenhuma foto", "Adicione pelo menos uma foto.")
            return

        output = self.output_path.get().strip()
        if not output:
            self.choose_output()
            output = self.output_path.get().strip()
            if not output:
                return

        if not output.lower().endswith(".pdf"):
            output += ".pdf"

        try:
            pages = [self._image_to_pdf_page(path) for path in self.files]
            first_page, remaining_pages = pages[0], pages[1:]
            first_page.save(output, "PDF", save_all=True, append_images=remaining_pages)
        except Exception as exc:
            messagebox.showerror("Nao foi possivel gerar o PDF", str(exc))
            return
        finally:
            for page in locals().get("pages", []):
                page.close()

        messagebox.showinfo("PDF criado", f"PDF gerado com sucesso:\n{output}")

    @staticmethod
    def _image_to_pdf_page(path):
        image = Image.open(path)
        image = ImageOps.exif_transpose(image)

        if image.mode in ("RGBA", "LA"):
            background = Image.new("RGB", image.size, "white")
            background.paste(image, mask=image.getchannel("A"))
            image.close()
            image = background
        elif image.mode != "RGB":
            image = image.convert("RGB")

        return image


def main():
    root = tk.Tk()
    app = PhotoToPdfApp(root)
    root.mainloop()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
