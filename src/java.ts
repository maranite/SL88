declare const Java: {
  type(t: string): any;
  type<K>(t: string): K;
  from(obj: any): any;
  from<K>(obj: any): K;
  isType(clazz: any): boolean;
  typeName(clazz: any): string;
  extend(...args: any[]): any;
  super(obj: any): any;
}

declare const Packages: any;

///-----

// JavaAdapter

function JavaAdapter(types: any[], ctorArg: any) {
  var NewType = Java.extend.apply(Java, types);
  return new NewType(ctorArg);
}


Object.defineProperty(this, "importClass", {
  configurable: true, enumerable: false, writable: true,
  value: function () {
    for (var arg in arguments) {
      var clazz = arguments[arg];
      if (Java.isType(clazz)) {
        var className = Java.typeName(clazz);
        var simpleName = className.substring(className.lastIndexOf('.') + 1);
        this[simpleName] = clazz;
      } else {
        throw new TypeError(clazz + " is not a Java class");
      }
    }
  }
});

//-----

type FilenameFilter = (dir: ioFile, name: string) => boolean;
type FileFilter = (dir: ioFile, name: string) => boolean;

interface ioFile {
  /** Tests whether the application can execute the file denoted by this abstract pathname. */
  canExecute(): boolean
  /** Tests whether the application can read the file denoted by this abstract pathname. */
  canRead(): boolean
  /** Tests whether the application can modify the file denoted by this abstract pathname. */
  canWrite(): boolean
  /** Compares two abstract pathnames lexicographically. */
  compareTo(pathname: ioFile): number
  /** Atomically creates a new, empty file named by this abstract pathname if and only if a file with this name does not yet exist. */
  createNewFile(): boolean
  /** Creates an empty file in the default temporary-file directory, using the given prefix and suffix to generate its name. */
  //static ioFile	createTempFile(String prefix, String suffix)
  /** Creates a new empty file in the specified directory, using the given prefix and suffix strings to generate its name. */
  //static ioFile	createTempFile(String prefix, String suffix, File directory)
  /** Deletes the file or directory denoted by this abstract pathname. */
  delete(): boolean;
  /** Requests that the file or directory denoted by this abstract pathname be deleted when the virtual machine terminates. */
  deleteOnExit(): void;
  /** Tests this abstract pathname for equality with the given object. */
  equals(obj: any): boolean;
  /** Tests whether the file or directory denoted by this abstract pathname exists. */
  exists(): boolean;
  /** Returns the absolute form of this abstract pathname. */
  getAbsoluteFile(): ioFile;
  /** Returns the absolute pathname string of this abstract pathname. */
  getAbsolutePath(): string;
  /** Returns the canonical form of this abstract pathname. */
  getCanonicalFile(): ioFile;
  /** Returns the canonical pathname string of this abstract pathname. */
  getCanonicalPath(): string;
  /** Returns the number of unallocated bytes in the partition named by this abstract path name. */
  getFreeSpace(): number;
  /** Returns the name of the file or directory denoted by this abstract pathname. */
  getName(): string;
  /** Returns the pathname string of this abstract pathname's parent, or null if this pathname does not name a parent directory. */
  getParent(): string;
  /** Returns the abstract pathname of this abstract pathname's parent, or null if this pathname does not name a parent directory. */
  getParentFile(): ioFile;
  /** Converts this abstract pathname into a pathname string. */
  getPath(): string;
  /** Returns the size of the partition named by this abstract pathname. */
  getTotalSpace(): number;
  /** Returns the number of bytes available to this virtual machine on the partition named by this abstract pathname. */
  getUsableSpace(): number;
  /** Computes a hash code for this abstract pathname. */
  hashCode(): number;
  /** Tests whether this abstract pathname is absolute. */
  isAbsolute(): boolean;
  /** Tests whether the file denoted by this abstract pathname is a directory. */
  isDirectory(): boolean;
  /** Tests whether the file denoted by this abstract pathname is a normal file. */
  isFile(): boolean;
  /** Tests whether the file named by this abstract pathname is a hidden file. */
  isHidden(): boolean;
  /** Returns the time that the file denoted by this abstract pathname was last modified. */
  lastModified(): number;
  /** Returns the length of the file denoted by this abstract pathname. */
  length(): number;
  /** Returns an array of strings naming the files and directories in the directory denoted by this abstract pathname. */
  list(): string[];
  /** Returns an array of strings naming the files and directories in the directory denoted by this abstract pathname that satisfy the specified filter. */
  list(filter: FilenameFilter): string[];
  /** Returns an array of abstract pathnames denoting the files in the directory denoted by this abstract pathname. */
  listFiles(): ioFile[];
  /** Returns an array of abstract pathnames denoting the files and directories in the directory denoted by this abstract pathname that satisfy the specified filter. */
  listFiles(filter: FileFilter): ioFile[];
  /** Returns an array of abstract pathnames denoting the files and directories in the directory denoted by this abstract pathname that satisfy the specified filter. */
  listFiles(filter: FilenameFilter): ioFile[];
  /** List the available filesystem roots. */
  //static ioFile[]	listRoots();
  /** Creates the directory named by this abstract pathname. */
  mkdir(): boolean;
  /** Creates the directory named by this abstract pathname, including any necessary but nonexistent parent directories. */
  mkdirs(): boolean;
  /** Renames the file denoted by this abstract pathname. */
  renameTo(dest: ioFile): boolean;
  /** A convenience method to set the owner's execute permission for this abstract pathname. */
  setExecutable(executable: boolean): boolean;
  /** Sets the owner's or everybody's execute permission for this abstract pathname. */
  setExecutable(executable: boolean, ownerOnly: boolean): boolean;
  /** Sets the last-modified time of the file or directory named by this abstract pathname. */
  setLastModified(time: number): boolean;
  /** A convenience method to set the owner's read permission for this abstract pathname. */
  setReadable(readable: boolean): boolean;
  /** Sets the owner's or everybody's read permission for this abstract pathname. */
  setReadable(readable: boolean, ownerOnly: boolean): boolean;
  /** Marks the file or directory named by this abstract pathname so that only read operations are allowed. */
  setReadOnly(): boolean;
  /** A convenience method to set the owner's write permission for this abstract pathname. */
  setWritable(writable: boolean): boolean;
  /** Sets the owner's or everybody's write permission for this abstract pathname. */
  setWritable(writable: boolean, ownerOnly: boolean): boolean;
  /** Returns a java.nio.file.Path object constructed from the this abstract path. */
  // toPath(): ioPath
  /** Returns the pathname string of this abstract pathname. */
  toString(): string;
}

interface ioFile {
  /** Creates a new File instance by converting the given pathname string into an abstract pathname. */
  new(pathname: string): ioFile;
  /** Creates a new File instance from a parent abstract pathname and a child pathname string.*/
  new(parent: ioFile, child: string): ioFile;
  /**Creates a new File instance from a parent pathname string and a child pathname string.  */
  new(parent: string, child: string): ioFile;
  /**   // Creates a new File instance by converting the given file: URI into an abstract pathname. */
  // new(uri : URI) : ioFile
  /** Creates an empty file in the default temporary-file directory, using the given prefix and suffix to generate its name. */
  createTempFile(prefix: string, suffix: string): ioFile;
  /** Creates a new empty file in the specified directory, using the given prefix and suffix strings to generate its name. */
  createTempFile(prefix: string, suffix: string, directory: ioFile): ioFile;
  /** List the available filesystem roots. */
  listRoots(): ioFile[];
}

interface ioPath {
  /**   Compares two abstract paths lexicographically. */
  compareTo(other: ioPath): number
  /**   Tests if this path ends with the given path. */
  endsWith(other: ioPath): boolean
  /**   Tests if this path ends with a Path, constructed by converting the given path string, in exactly the manner specified by the endsWith(Path) method. */
  endsWith(other: string): boolean
  /**   Tests this path for equality with the given object. */
  equals(other: any): boolean
  /**   Returns the name of the file or directory denoted by this path as a Path object. */
  getFileName(): ioPath
  /**   Returns the file system that created this object. */
  getFileSystem(): ioFileSystem
  /**   Returns a name element of this path as a Path object. */
  getName(index: number): ioPath
  /**   Returns the number of name elements in the path. */
  getNameCount(): number
  /**   Returns the parent path, or null if this path does not have a parent. */
  getParent(): ioPath
  /**   Returns the root component of this path as a Path object, or null if this path does not have a root component. */
  getRoot(): ioPath
  /**   Computes a hash code for this path. */
  hashCode(): number
  /**   Tells whether or not this path is absolute. */
  isAbsolute(): boolean
  /**   Returns an iterator over the name elements of this path. */
  // Iterator <  > iterator(): ioPath
  /**   Returns a path that is this path with redundant name elements eliminated. */
  normalize(): ioPath
  //   /**   Registers the file located by this path with a watch service. */
  //   register(WatchService watcher, WatchEvent.Kind<?>...events): WatchKey
  // /**   Registers the file located by this path with a watch service. */
  // register(WatchService watcher, WatchEvent.Kind <?> [] events, WatchEvent.Modifier...modifiers): WatchKey
  /**   Constructs a relative path between this path and a given path. */
  relativize(other: ioPath): ioPath
  /**   Resolve the given path against this path. */
  resolve(other: ioPath): ioPath
  /**   Converts a given path string to a Path and resolves it against this Path in exactly the manner specified by the resolve method. */
  resolve(other: string): ioPath
  /**   Resolves the given path against this path's parent path. */
  resolveSibling(other: ioPath): ioPath
  /**   Converts a given path string to a Path and resolves it against this path's parent path in exactly the manner specified by the resolveSibling method. */
  resolveSibling(other: string): ioPath
  /**   Tests if this path starts with the given path. */
  startsWith(other: ioPath): boolean
  /**   Tests if this path starts with a Path, constructed by converting the given path string, in exactly the manner specified by the startsWith(Path) method. */
  startsWith(other: string): boolean
  /**   Returns a relative Path that is a subsequence of the name elements of this path. */
  subpath(beginIndex: number, endIndex: number): ioPath
  /**   Returns a Path object representing the absolute path of this path. */
  toAbsolutePath(): ioPath
  /**   Returns a File object representing this path. */
  toFile(): ioFile
  /**   Returns the real path of an existing file. */
  toRealPath(...options: LinkOption[]): ioPath
  /**   Returns the string representation of this path. */
  toString(): string
  // /**   Returns a URI to represent this path. */
  // toUri(): URI
};


interface StandardCharsets {
  ISO_8859_1: Charset;
  US_ASCII: Charset;
  UTF_16: Charset;
  UTF_16BE: Charset;
  UTF_16LE: Charset;
  UTF_8: Charset;
};

interface ioFiles {
  // /** Copies all bytes from an input stream to a file. */
  // copy(in: InputStream, target: ioPath, CopyOption...options): number
  // /** Copies all bytes from a file to an output stream. */
  // copy(source: ioPath, out: OutputStream): number
  // /** Copy a file to a target file. */
  // copy(source: ioPath, target: ioPath, ...options: CopyOption): ioPath
  /** Creates a directory by creating all nonexistent parent directories first. */
  createDirectories(dir: ioPath, ...attrs: ioFileAttribute<any>[]): ioPath
  /** Creates a new directory. */
  createDirectory(dir: ioPath, ...attrs: ioFileAttribute<any>[]): ioPath
  /** Creates a new and file :empty, failing if the file already exists. */
  createFile(path: ioPath, ...attrs: ioFileAttribute<any>[]): ioPath
  /** Creates a new link (entry :directory) for an existing file (operation :optional). */
  createLink(link: ioPath, existing: ioPath): ioPath
  /** Creates a symbolic link to a target (operation :optional). */
  createSymbolicLink(link: ioPath, target: ioPath, ...attrs: ioFileAttribute<any>[]): ioPath
  /** Creates a new directory in the directory :specified, using the given prefix to generate its name. */
  createTempDirectory(dir: ioPath, prefix: string, ...attrs: ioFileAttribute<any>[]): ioPath
  /** Creates a new directory in the default temporary-directory :file, using the given prefix to generate its name. */
  createTempDirectory(prefix: string, ...attrs: ioFileAttribute<any>[]): ioPath
  /** Creates a new empty file in the directory :specified, using the given prefix and suffix strings to generate its name. */
  createTempFile(dir: ioPath, prefix: string, suffix: string, ...attrs: ioFileAttribute<any>[]): ioPath
  /** Creates an empty file in the default temporary-directory :file, using the given prefix and suffix to generate its name. */
  createTempFile(prefix: string, suffix: string, ...attrs: ioFileAttribute<any>[]): ioPath
  /** Deletes a file. */
  delete(path: ioPath): void
  /** Deletes a file if it exists. */
  deleteIfExists(path: ioPath): boolean
  /** Tests whether a file exists. */
  exists(path: ioPath, ...options: LinkOption[]): boolean
  /** Reads the value of a file attribute. */
  getAttribute(path: ioPath, attribute: string, ...options: LinkOption[]): Object
  // /** Returns a file attribute view of a given type. */
  // getFileAttributeView<V extends FileAttributeView>(path: ioPath, type: any, ...options: LinkOption[]): V
  // /** Returns the FileStore representing the file store where a file is located. */
  // getFileStore(path: ioPath): FileStore

  /** Returns a file's last modified time. */
  //getLastModifiedTime(path: ioPath, ...options: LinkOption[]): FileTime
  // /** Returns the owner of a file. */
  // getOwner(path: ioPath, ...options: LinkOption[]): UserPrincipal
  // /** Returns a file's POSIX file permissions. */
  // getPosixFilePermissions(path : ioPath, ...options : LinkOption[]) : Set<PosixFilePermission>
  // /** Tests whether a file is a directory. */
  isDirectory(path: ioPath, ...options: LinkOption[]): boolean
  /** Tests whether a file is executable. */
  isExecutable(path: ioPath): boolean
  /** Tells whether or not a file is considered hidden. */
  isHidden(path: ioPath): boolean
  /** Tests whether a file is readable. */
  isReadable(path: ioPath): boolean
  /** Tests whether a file is a regular file with opaque content. */
  isRegularFile(path: ioPath, ...options: LinkOption[]): boolean
  /** Tests if two paths locate the same file. */
  isSameFile(path: ioPath, path2: ioPath): boolean
  /** Tests whether a file is a symbolic link. */
  isSymbolicLink(path: ioPath): boolean
  /** Tests whether a file is writable. */
  isWritable(path: ioPath): boolean
  /** Move or rename a file to a target file. */
  move(source: ioPath, target: ioPath, ...options: CopyOption[]): ioPath
  // /** Opens a file reading :for, returning a BufferedReader that may be used to read text from the file in an efficient manner. */
  // newBufferedReader(path: ioPath, cs: Charset): BufferedReader
  // /** Opens or creates a file writing :for, returning a BufferedWriter that may be used to write text to the file in an efficient manner. */
  // newBufferedWriter(path: ioPath, cs: Charset, ...options: OpenOptions[]): BufferedWriter
  // /** Opens or creates file :a, returning a seekable byte channel to access the file. */
  // newByteChannel(path: ioPath, ...options: OpenOptions[]): SeekableByteChannel
  // /** Opens or creates file :a, returning a seekable byte channel to access the file. */
  // newByteChannel(path: ioPath, options : Set<OpenOption> , ...attrs: ioFileAttribute < any > []) : SeekableByteChannel
  /** Opens directory :a, returning a DirectoryStream to iterate over all entries in the directory. */
  newDirectoryStream(dir: ioPath): DirectoryStream<ioPath>
  // /** Opens directory :a, returning a DirectoryStream to iterate over the entries in the directory. */
  // newDirectoryStream(dir : ioPath, filter : DirectoryStream.Filter <? super Path >) : DirectoryStream<Path>
  // /** Opens directory :a, returning a DirectoryStream to iterate over the entries in the directory. */
  // newDirectoryStream(dir : ioPath, glob : string) : DirectoryStream<Path>
  // /** Opens file :a, returning an input stream to read from the file. */
  // newInputStream(path : ioPath, ...options : OpenOptions[]) : InputStream
  // /** Opens or creates file :a, returning an output stream that may be used to write bytes to the file. */
  // newOutputStream(path : ioPath, ...options : OpenOptions[]) : OutputStream
  /** Tests whether the file located by this path does not exist. */
  notExists(path: ioPath, ...options: LinkOption[]): boolean
  /** Probes the content type of a file. */
  probeContentType(path: ioPath): string
  /** Reads all the bytes from a file. */
  readAllBytes(path: ioPath): number[]
  /** Read all lines from a file. */
  readAllLines(path: ioPath, cs: Charset): string[]

  /** Reads a file's attributes as a bulk operation. */
  //readAttributes <A extends BasicFileAttributes>(path :Path, Class<A> type, LinkOption... options) : A
  ///** Reads a set of file attributes as a bulk operation. */
  // readAttributes(path : ioPath, attributes : string, ...options : LinkOption[]) : Map<String, Object>  
  // /** Reads the target of a symbolic link (operation :optional). */
  // readSymbolicLink(link : ioPath) : ioPath
  // /** Sets the value of a file attribute. */
  // setAttribute(path : ioPath, attribute : string, value : Object, ...options : LinkOption[]) : ioPath
  // /** Updates a file's last modified time attribute. */
  // setLastModifiedTime(path : ioPath, time : FileTime) : ioPath
  // /** Updates the file owner. */
  // setOwner(path : ioPath, owner : UserPrincipal) : ioPath
  /** Sets a file's POSIX permissions. */
  // setPosixFilePermissions(path : ioPath, perms: ioSet<PosixFilePermission> ) : ioPath

  /** Returns the size of a file (bytes :in). */
  size(path: ioPath): number
  // /** Walks a file tree. */
  // walkFileTree(start : ioPath, FileVisitor <? super Path > visitor) : ioPath
  /** Walks a file tree. */
  // walkFileTree(start : ioPath, Set < FileVisitOption > options, maxDepth : number, FileVisitor <? super Path > visitor) : ioPath
  /** Writes bytes to a file. */
  write(path: ioPath, bytes: number[], ...options: OpenOptions[]): ioPath
  // /** Write lines of text to a file. */
  // write(path : ioPath, Iterable <? extends CharSequence > lines, cs : Charset, ...options : OpenOptions[]) : ioPath
}

interface ioFileSystem {
  /** Closes this file system. */
  close(): void;
  // /** Returns an object to iterate over the underlying file stores. */
  // getFileStores() : Iterable<FileStore>
  /** Converts a path string, or a sequence of strings that when joined form a path string, to a Path. */
  getPath(first: string, ...more: string[]): ioPath
  // /** Returns a PathMatcher that performs match operations on the String representation of Path objects by interpreting a given pattern. */
  // abstract PathMatcher	getPathMatcher(String syntaxAndPattern)
  /** Returns an object to iterate over the paths of the root directories. */
  getRootDirectories(): ioPath[];

  /** Returns the name separator, represented as a string. */
  getSeparator(): string
  // /** Returns the UserPrincipalLookupService for this file system (optional operation). */
  // abstract UserPrincipalLookupService	getUserPrincipalLookupService()
  // /** Tells whether or not this file system is open. */
  // abstract boolean	isOpen()
  // /** Tells whether or not this file system allows only read-only access to its file stores. */
  // abstract boolean	isReadOnly()
  // /** Constructs a new WatchService (optional operation). */
  // abstract WatchService	newWatchService()
  // /** Returns the provider that created this file system. */
  // abstract FileSystemProvider	provider()
  // /** Returns the set of the names of the file attribute views supported by this FileSystem. */
  // abstract Set<String>	supportedFileAttributeViews()
}

interface ioFileAttribute<T> { };
interface ioFileStor { };
interface OpenOptions { };
interface CopyOption { };
interface LinkOption { };
interface DirectoryStream<K> { };
interface ioSet<K> { };
interface Charset { };

const Charset = Java.type<Charset>('java.nio.charset.Charset');
const StandardCharsets = Java.type<StandardCharsets>('java.nio.charset.StandardCharsets');
const ioFiles = Java.type<ioFiles>('java.nio.file.Files');
const ioFile = Java.type<ioFile>("java.io.File");
const ioPath = Java.type<ioPath>("java.nio.file.Path");

const ioFileSystems = Java.type<{
  /** Returns the default FileSystem. */
  getDefault(): ioFileSystem;
  // /** Returns a reference to an existing FileSystem. */
  // getFileSystem(URI uri) : ioFileSystem;
  // /** Constructs a new FileSystem to access the contents of a file as a file system. */
  // 	newFileSystem(Path path, ClassLoader loader) : ioFileSystem;
  // /** Constructs a new file system that is identified by a URI. */
  //	newFileSystem(URI uri, Map<String,?> env) :ioFileSystem;
  // /** Constructs a new file system that is identified by a URI. */
  // newFileSystem(URI uri, Map<String,?> env, ClassLoader loader) : ioFileSystem
}>('java.nio.file.FileSystems');

const fileSys = new class
{
  fileSystem = ioFileSystems.getDefault();
  separator = this.fileSystem.getSeparator();  
  getPath = this.fileSystem.getPath;
} 



